// ===== 匿名社区 - 树洞 v2 =====
// 新增：垂直场景频道、AI内容审核、随机发现、角色标签、情绪标签
// 新增：后端 API 对接、叶脉号系统、跨用户私信/信件

// ===== API 基础层 =====
const API_BASE = 'http://localhost:3000';
// 后续部署时改为 Railway 的 URL

async function api(method, path, body) {
    try {
        const res = await fetch(API_BASE + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `API ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.warn('[API] 请求失败:', method, path, e.message);
        return null;
    }
}

// ===== 远程用户注册/登录 =====
const RemoteUser = {
    async register() {
        const me = Identity.getMe();
        const role = Roles.getRole();
        const result = await api('POST', '/api/register', {
            nickname: me.name,
            role: role,
            mbti: me.mbti,
            avatar_style: me.style,
            avatar_emoji: me.emoji,
            avatar_color: me.color
        });
        if (result && result.userId && result.veinId) {
            DB.set('userId', result.userId);
            DB.set('veinId', result.veinId);
            return result;
        }
        return null;
    },

    getUserId() {
        return DB.get('userId', null);
    },

    getVeinId() {
        return DB.get('veinId', null);
    },

    isRegistered() {
        return !!this.getUserId() && !!this.getVeinId();
    },

    async ensureRegistered() {
        if (this.isRegistered()) return true;
        const result = await this.register();
        return !!result;
    },

    async updateUser(data) {
        const userId = this.getUserId();
        if (!userId) return null;
        return await api('PUT', '/api/user/' + userId, data);
    },

    async findByVeinId(veinId) {
        return await api('GET', '/api/user/' + veinId);
    }
};

// ===== 数据存储层 =====
const DB = {
    get(key, fallback = null) {
        try {
            const data = localStorage.getItem('treehole_' + key);
            return data ? JSON.parse(data) : fallback;
        } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem('treehole_' + key, JSON.stringify(value)); } catch(e) { console.warn('存储空间已满'); }
    },
    remove(key) {
        localStorage.removeItem('treehole_' + key);
    }
};

// ===== 角色系统 =====
const Roles = {
    map: {
        student: { emoji: '🎓', name: '学生党' },
        worker: { emoji: '💼', name: '打工人' },
        freelancer: { emoji: '🎨', name: '自由职业' },
        other: { emoji: '🌟', name: '神秘旅人' }
    },
    getRole() {
        return DB.get('my_role', null);
    },
    setRole(role) {
        DB.set('my_role', role);
    },
    getBadgeHTML(role) {
        if (!role) return '';
        const info = this.map[role];
        if (!info) return '';
        return `<span class="role-badge">${info.emoji} ${info.name}</span>`;
    }
};

// ===== 情绪系统 =====
const Moods = {
    map: {
        '开心': '😊', '平静': '😌', '感动': '🥹', '焦虑': '😰',
        '难过': '😢', '愤怒': '😤', '迷茫': '🌀', '期待': '✨'
    },
    getBadgeHTML(mood) {
        if (!mood || !this.map[mood]) return '';
        return `<span class="mood-badge" data-mood="${mood}">${this.map[mood]} ${mood}</span>`;
    }
};

// ===== 频道系统 =====
const Channels = {
    map: {
        '校园': '🎓', '职场': '💼', '情感': '💕', '生活': '🏠', '树洞': '🌳'
    },
    getBadgeHTML(channel) {
        if (!channel || !this.map[channel]) return '';
        return `<span class="channel-badge">${this.map[channel]} ${channel}</span>`;
    }
};

// ===== AI 内容审核系统 =====
const ContentAudit = {
    // 敏感词库（基础版）
    sensitivePatterns: [
        /杀\s*死|去\s*死|自\s*杀|自\s*残|跳\s*楼|割\s*腕/g,
        /毒品|吸毒|贩毒|大麻|海洛因|冰毒/g,
        /赌博|赌场|下注|赌资/g,
        /诈骗|骗钱|传销|洗钱/g,
        /色情|裸照|约炮/g
    ],

    // 检测内容
    audit(text) {
        if (!text) return { passed: true, warnings: [] };

        const warnings = [];
        let cleanedText = text;

        // 检测敏感词
        this.sensitivePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                const word = matches[0].replace(/\s/g, '');
                warnings.push(`内容包含敏感词汇"${word}"`);
            }
        });

        // 检测是否过短（可能是垃圾内容）
        if (text.trim().length < 5) {
            warnings.push('内容过短，请写得更详细一些');
        }

        // 检测是否全是大写或重复字符（可能是刷屏）
        if (/^(.)\1{10,}$/.test(text.replace(/\s/g, ''))) {
            warnings.push('内容疑似刷屏，请写有意义的内容');
        }

        // 检测是否包含过多特殊字符
        const specialCharRatio = (text.match(/[^\w\s\u4e00-\u9fff，。！？、；：""''（）【】]/g) || []).length / text.length;
        if (specialCharRatio > 0.5) {
            warnings.push('内容包含过多特殊字符');
        }

        return {
            passed: warnings.length === 0,
            warnings
        };
    },

    // 审核帖子并返回结果
    auditPost(title, content) {
        const titleResult = this.audit(title);
        const contentResult = this.audit(content);
        const allWarnings = [...new Set([...titleResult.warnings, ...contentResult.warnings])];
        return {
            passed: allWarnings.length === 0,
            warnings: allWarnings
        };
    }
};

// ===== 匿名身份系统 =====
const Identity = {
    adjectives: [
        '温柔的', '勇敢的', '安静的', '自由的', '神秘的',
        '快乐的', '孤独的', '善良的', '执着的', '浪漫的',
        '淡然的', '热烈的', '从容的', '倔强的', '洒脱的',
        '细腻的', '率真的', '深沉的', '灵动的', '笃定的',
        '清澈的', '朦胧的', '悠然的', '炽热的', '素雅的'
    ],
    nouns: [
        '猫咪', '旅人', '星辰', '海鸥', '云朵',
        '树影', '微风', '月光', '萤火', '飞鸟',
        '浪花', '落叶', '雪花', '晨露', '晚霞',
        '溪流', '山谷', '灯塔', '纸鹤', '风铃',
        '橡树', '鲸鱼', '极光', '竹林', '琴弦'
    ],
    colors: [
        '#4a9e7d', '#e07c5a', '#5b8cc9', '#c9a84c',
        '#9b6bb0', '#5bbfb5', '#d4727a', '#7aad5b',
        '#c7854e', '#6b7fc4', '#b05b8c', '#5ba89e'
    ],
    // 可选 Emoji 列表
    emojiOptions: [
        '🐱','🐶','🐰','🦊','🐻','🐼','🐨','🐯',
        '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦄',
        '🌸','🌺','🌻','🌹','🌷','🍀','🌿','🍃',
        '🌙','⭐','☀️','🌈','🔥','💧','❄️','🌊',
        '🎵','🎨','📚','✏️','🎯','🎲','💡','🔮',
        '🦋','🐝','🐞','🐢','🐙','🦀','🐬','🐳',
        '🍕','🍜','🍦','🧁','☕','🍵','🧋','🍺',
        '💭','❤️','🧡','💜','💙','💚','💛','🤍'
    ],
    // 渐变色方案
    gradients: [
        { c1: '#667eea', c2: '#764ba2' },
        { c1: '#f093fb', c2: '#f5576c' },
        { c1: '#4facfe', c2: '#00f2fe' },
        { c1: '#43e97b', c2: '#38f9d7' },
        { c1: '#fa709a', c2: '#fee140' },
        { c1: '#a18cd1', c2: '#fbc2eb' },
        { c1: '#fccb90', c2: '#d57eeb' },
        { c1: '#e0c3fc', c2: '#8ec5fc' },
        { c1: '#f5576c', c2: '#ff6a00' },
        { c1: '#0ba360', c2: '#3cba92' },
    ],

    // MBTI 类型数据
    mbtiTypes: ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'],
    mbtiInfo: {
        'INTJ': { emoji: '🧠', label: '建筑师', group: 'NT' },
        'INTP': { emoji: '🔬', label: '逻辑学家', group: 'NT' },
        'ENTJ': { emoji: '👑', label: '指挥官', group: 'NT' },
        'ENTP': { emoji: '💡', label: '辩论家', group: 'NT' },
        'INFJ': { emoji: '🔮', label: '提倡者', group: 'NF' },
        'INFP': { emoji: '🦋', label: '调停者', group: 'NF' },
        'ENFJ': { emoji: '🌟', label: '主人公', group: 'NF' },
        'ENFP': { emoji: '🎭', label: '竞选者', group: 'NF' },
        'ISTJ': { emoji: '📋', label: '物流师', group: 'SJ' },
        'ISFJ': { emoji: '🛡️', label: '守卫者', group: 'SJ' },
        'ESTJ': { emoji: '🏢', label: '总经理', group: 'SJ' },
        'ESFJ': { emoji: '🤝', label: '执政官', group: 'SJ' },
        'ISTP': { emoji: '🔧', label: '鉴赏家', group: 'SP' },
        'ISFP': { emoji: '🎨', label: '探险家', group: 'SP' },
        'ESTP': { emoji: '🚀', label: '企业家', group: 'SP' },
        'ESFP': { emoji: '🎉', label: '表演者', group: 'SP' },
    },
    // MBTI 契合度矩阵（简化版，基于认知功能互补）
    mbtiCompatibility: {
        'NT': { 'NF': 0.85, 'NT': 0.7, 'SJ': 0.5, 'SP': 0.6 },
        'NF': { 'NT': 0.85, 'NF': 0.8, 'SJ': 0.55, 'SP': 0.65 },
        'SJ': { 'NF': 0.55, 'NT': 0.5, 'SJ': 0.75, 'SP': 0.7 },
        'SP': { 'NF': 0.65, 'NT': 0.6, 'SJ': 0.7, 'SP': 0.75 },
    },

    init() {
        let identity = DB.get('my_identity');
        if (!identity) {
            identity = this.generate();
            DB.set('my_identity', identity);
        }
        // 兼容旧数据：补充新字段
        if (!identity.emoji) identity.emoji = null;
        if (!identity.style) identity.style = 'emoji';
        if (!identity.gradient) identity.gradient = this.gradients[Math.floor(Math.random() * this.gradients.length)];
        if (!identity.mbti) identity.mbti = null;
        if (!identity.role) identity.role = Roles.getRole();
        DB.set('my_identity', identity);
        return identity;
    },

    generate() {
        const adj = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const noun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const id = this.generateId();
        return {
            name: adj + noun, color, id,
            emoji: null,
            style: 'emoji',
            gradient: this.gradients[Math.floor(Math.random() * this.gradients.length)],
            mbti: null
        };
    },

    generateId() {
        return 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    },

    getMe() {
        return this.init();
    },

    getAvatarHTML(identity, size = 40) {
        if (!identity) identity = this.getMe();
        const s = size;
        const fs = Math.max(s * 0.45, 12);

        if (identity.style === 'emoji' && identity.emoji) {
            return `<div class="anonymous-avatar" style="background:${identity.color};width:${s}px;height:${s}px;font-size:${fs * 1.1}px">${identity.emoji}</div>`;
        }
        if (identity.style === 'gradient') {
            return `<div class="anonymous-avatar avatar-gradient" style="--c1:${identity.gradient.c1};--c2:${identity.gradient.c2};width:${s}px;height:${s}px;font-size:${fs}px;color:white">${identity.emoji || identity.name.charAt(0)}</div>`;
        }
        // 默认：首字母
        const initial = identity.name.replace(/的/g, '').charAt(0);
        return `<div class="anonymous-avatar avatar-letter" style="background:${identity.color};width:${s}px;height:${s}px;font-size:${fs}px">${initial}</div>`;
    },

    getNameHTML(identity) {
        if (!identity) identity = this.getMe();
        return `<span class="anonymous-name">${escapeHtml(identity.name)}</span>`;
    },

    getMbtiBadgeHTML(identity) {
        if (!identity || !identity.mbti) return '';
        const info = this.mbtiInfo[identity.mbti];
        if (!info) return '';
        return `<span class="mbti-badge" data-mbti="${identity.mbti}">${info.emoji} ${identity.mbti}</span>`;
    },

    getCompatibility(mbti1, mbti2) {
        if (!mbti1 || !mbti2) return null;
        const info1 = this.mbtiInfo[mbti1];
        const info2 = this.mbtiInfo[mbti2];
        if (!info1 || !info2) return null;
        const score = this.mbtiCompatibility[info1.group]?.[info2.group] || 0.5;
        return Math.round(score * 100);
    }
};

// ===== 时间格式化 =====
function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;

    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ===== 帖子数据管理 =====
const Posts = {
    getAll() {
        return DB.get('posts', []);
    },

    save(posts) {
        DB.set('posts', posts);
    },

    create(data) {
        const posts = this.getAll();
        const me = Identity.getMe();
        me.role = Roles.getRole();
        const post = {
            id: 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            author: me,
            title: data.title,
            content: data.content,
            tags: data.tags || [],
            channel: data.channel || '树洞',
            mood: data.mood || null,
            image: data.image || null,
            likes: [],
            comments: [],
            reports: [],
            auditStatus: 'approved', // approved, pending, rejected
            show_vein: data.show_vein !== undefined ? data.show_vein : 1,
            createdAt: Date.now()
        };
        posts.unshift(post);
        this.save(posts);

        // 尝试同步到远程
        (async () => {
            const userId = RemoteUser.getUserId();
            if (userId) {
                await api('POST', '/api/posts', {
                    user_id: userId,
                    title: post.title,
                    content: post.content,
                    channel: post.channel,
                    mood: post.mood,
                    tags: post.tags,
                    show_vein: post.show_vein
                });
            }
        })();

        return post;
    },

    getById(id) {
        return this.getAll().find(p => p.id === id);
    },

    toggleLike(postId) {
        const posts = this.getAll();
        const post = posts.find(p => p.id === postId);
        if (!post) return false;

        const userId = Identity.getMe().id;
        const idx = post.likes.indexOf(userId);
        if (idx === -1) {
            post.likes.push(userId);
        } else {
            post.likes.splice(idx, 1);
        }
        this.save(posts);
        return post.likes.includes(userId);
    },

    addComment(postId, text) {
        const posts = this.getAll();
        const post = posts.find(p => p.id === postId);
        if (!post) return null;

        // 审核评论
        const audit = ContentAudit.audit(text);
        if (!audit.passed) {
            showToast('评论未通过审核：' + audit.warnings[0]);
            return null;
        }

        const comment = {
            id: 'c_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            author: Identity.getMe(),
            text,
            createdAt: Date.now()
        };
        post.comments.push(comment);
        this.save(posts);
        return comment;
    },

    isLiked(postId) {
        const post = this.getById(postId);
        return post ? post.likes.includes(Identity.getMe().id) : false;
    },

    // 举报帖子
    report(postId, reason, detail) {
        const posts = this.getAll();
        const post = posts.find(p => p.id === postId);
        if (!post) return false;

        if (!post.reports) post.reports = [];
        post.reports.push({
            reason,
            detail,
            reporterId: Identity.getMe().id,
            createdAt: Date.now()
        });

        // 如果举报数 >= 3，自动标记为待审核
        if (post.reports.length >= 3) {
            post.auditStatus = 'pending';
        }

        this.save(posts);
        return true;
    }
};

// ===== 私信系统 =====
const Messages = {
    getAll() {
        return DB.get('messages', []);
    },

    save(msgs) {
        DB.set('messages', msgs);
    },

    getConversation(targetUserId) {
        const msgs = this.getAll();
        const myId = Identity.getMe().id;
        return msgs.find(m =>
            (m.participant1 === myId && m.participant2 === targetUserId) ||
            (m.participant1 === targetUserId && m.participant2 === myId)
        );
    },

    send(targetUserId, targetName, targetColor, text, targetMbti) {
        let msgs = this.getAll();
        const myId = Identity.getMe().id;
        const myIdentity = Identity.getMe();

        let conversation = this.getConversation(targetUserId);

        if (!conversation) {
            conversation = {
                id: 'conv_' + Date.now().toString(36),
                participant1: myId,
                participant2: targetUserId,
                participant1Info: { name: myIdentity.name, color: myIdentity.color },
                participant2Info: { name: targetName, color: targetColor, mbti: targetMbti || null },
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            msgs.push(conversation);
        }

        conversation.messages.push({
            id: 'm_' + Date.now().toString(36),
            senderId: myId,
            text,
            createdAt: Date.now()
        });
        conversation.updatedAt = Date.now();

        this.save(msgs);

        // 尝试同步到远程（跨用户私信）
        (async () => {
            const myUserId = RemoteUser.getUserId();
            // targetUserId 可能是本地 id 或远程 userId
            const otherRemoteId = DB.get('remoteUserId_' + targetUserId) || targetUserId;
            if (myUserId && otherRemoteId && otherRemoteId !== myId) {
                await api('POST', '/api/messages', {
                    from_id: myUserId,
                    to_id: otherRemoteId,
                    content: text
                });
            }
        })();

        return conversation;
    },

    getConversations() {
        const msgs = this.getAll();
        const myId = Identity.getMe().id;
        return msgs
            .filter(m => m.participant1 === myId || m.participant2 === myId)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getUnreadCount() {
        const convs = this.getConversations();
        const myId = Identity.getMe().id;
        let count = 0;
        convs.forEach(c => {
            const lastMsg = c.messages[c.messages.length - 1];
            if (lastMsg && lastMsg.senderId !== myId) {
                const read = DB.get('read_' + c.id);
                if (!read || read < lastMsg.createdAt) {
                    count++;
                }
            }
        });
        return count;
    },

    markAsRead(convId) {
        const conv = this.getAll().find(c => c.id === convId);
        if (conv) {
            const lastMsg = conv.messages[conv.messages.length - 1];
            if (lastMsg) {
                DB.set('read_' + convId, lastMsg.createdAt);
            }
        }
    },

    // 从远程拉取私信
    async fetchRemoteMessages(otherId) {
        const myUserId = RemoteUser.getUserId();
        if (!myUserId || !otherId) return null;
        return await api('GET', '/api/messages/' + myUserId + '?other_id=' + otherId);
    }
};

// ===== 路由系统 =====
let currentPage = 'home';
let currentTag = 'all';
let currentChannel = 'all';
let currentSort = 'newest';
let currentSearch = '';
let currentPostId = null;
let currentConvId = null;
let dmTarget = null;
let uploadedImage = null;
let currentDiscoverPostId = null;
let reportTargetPostId = null;

function navigate(page, data = {}, pushState = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    currentPage = page;

    if (pushState) {
        const hash = page === 'home' ? '' : `#${page}${data.postId ? '/' + data.postId : ''}`;
        history.pushState({ page, data }, '', hash || window.location.pathname);
    }

    // 更新移动端底部 Tab 高亮
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const tabMap = { home: 'home', create: 'create', messages: 'messages', diary: 'diary', letter: 'letter' };
    if (tabMap[page]) {
        const tab = document.querySelector(`.tab-item[data-tab="${tabMap[page]}"]`);
        if (tab) tab.classList.add('active');
    }

    switch (page) {
        case 'home':
            document.getElementById('page-home').classList.add('active');
            renderPostList();
            break;
        case 'create':
            document.getElementById('page-create').classList.add('active');
            renderCreatePage();
            break;
        case 'detail':
            currentPostId = data.postId;
            document.getElementById('page-detail').classList.add('active');
            renderPostDetail(data.postId);
            break;
        case 'messages':
            document.getElementById('page-messages').classList.add('active');
            renderMessages();
            break;
        case 'diary':
            document.getElementById('page-diary').classList.add('active');
            renderDiaryPage();
            break;
        case 'letter':
            document.getElementById('page-letter').classList.add('active');
            renderLetterPage();
            break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateMsgBadge();
    renderNavIdentity();
}

// ===== Hero 折叠 =====
function toggleHero() {
    const header = document.getElementById('homeHeader');
    const expandBtn = document.getElementById('heroExpandBtn');
    if (!header) return;
    header.classList.toggle('collapsed');
    const isCollapsed = header.classList.contains('collapsed');
    DB.set('hero_collapsed', isCollapsed);
    if (expandBtn) expandBtn.style.display = isCollapsed ? 'inline-flex' : 'none';
}

function initHero() {
    const header = document.getElementById('homeHeader');
    const expandBtn = document.getElementById('heroExpandBtn');
    if (!header) return;
    const collapsed = DB.get('hero_collapsed', false);
    if (collapsed) {
        header.classList.add('collapsed');
        if (expandBtn) expandBtn.style.display = 'inline-flex';
    }
}

// ===== 首页渲染 =====
async function renderPostList() {
    let posts = Posts.getAll();

    // 尝试从远程拉取帖子（合并，不覆盖本地）
    try {
        const channel = currentChannel !== 'all' ? currentChannel : undefined;
        const remotePosts = await api('GET', '/api/posts?page=1&limit=50' + (channel ? '&channel=' + channel : ''));
        if (remotePosts && Array.isArray(remotePosts) && remotePosts.length > 0) {
            const localIds = new Set(posts.map(p => p.id));
            const localRemoteIds = new Set(posts.filter(p => p._remoteId).map(p => p._remoteId));
            remotePosts.forEach(rp => {
                if (!localRemoteIds.has(rp.id)) {
                    const localPost = {
                        id: 'remote_p_' + rp.id,
                        _remoteId: rp.id,
                        author: {
                            name: rp.nickname || '匿名用户',
                            color: rp.avatar_color || '#5b8c6e',
                            id: 'remote_' + rp.user_id,
                            emoji: rp.avatar_emoji || null,
                            style: rp.avatar_style || 'emoji',
                            role: rp.role || null,
                            mbti: rp.mbti || null
                        },
                        title: rp.title,
                        content: rp.content,
                        tags: rp.tags || [],
                        channel: rp.channel || '树洞',
                        mood: rp.mood || null,
                        image: null,
                        likes: [],
                        comments: (rp.comments || []).map(c => ({
                            id: 'rc_' + (c.id || Math.random().toString(36).substr(2, 6)),
                            author: {
                                name: c.nickname || '匿名用户',
                                color: c.avatar_color || '#5b8c6e',
                                id: 'remote_' + (c.user_id || ''),
                                emoji: c.avatar_emoji || null,
                                style: c.avatar_style || 'emoji',
                                role: c.role || null,
                                mbti: c.mbti || null
                            },
                            text: c.content || c.text || '',
                            createdAt: new Date(c.created_at || Date.now()).getTime()
                        })),
                        reports: [],
                        auditStatus: 'approved',
                        show_vein: rp.show_vein || 0,
                        createdAt: new Date(rp.created_at || Date.now()).getTime()
                    };
                    posts.push(localPost);
                }
            });
            // 按时间排序
            posts.sort((a, b) => b.createdAt - a.createdAt);
        }
    } catch (e) {
        // 远程拉取失败，使用本地数据
    }

    // 过滤掉被拒绝的帖子
    posts = posts.filter(p => p.auditStatus !== 'rejected');

    // 搜索过滤
    if (currentSearch) {
        const q = currentSearch.toLowerCase();
        posts = posts.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.content.toLowerCase().includes(q)
        );
    }

    // 频道过滤
    if (currentChannel !== 'all') {
        posts = posts.filter(p => p.channel === currentChannel);
    }

    // 标签过滤
    if (currentTag !== 'all') {
        posts = posts.filter(p => p.tags.includes(currentTag));
    }

    // 排序
    switch (currentSort) {
        case 'newest':
            posts.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'popular':
            posts.sort((a, b) => b.likes.length - a.likes.length);
            break;
        case 'commented':
            posts.sort((a, b) => b.comments.length - a.comments.length);
            break;
    }

    const container = document.getElementById('postList');
    const empty = document.getElementById('emptyState');

    if (posts.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = posts.map((post, i) => {
        const isHot = post.likes.length >= 5 || post.comments.length >= 5;
        return `
        <article class="post-card ${post.auditStatus === 'pending' ? 'audit-pending' : ''} ${isHot ? 'glow' : ''}" data-mood="${post.mood || ''}" style="animation-delay:${i * 0.05}s" onclick="navigate('detail', {postId:'${post.id}'})">
            <div class="post-card-header">
                ${Identity.getAvatarHTML(post.author)}
                <div class="post-meta">
                    ${Identity.getNameHTML(post.author)}
                    ${Roles.getBadgeHTML(post.author.role)}
                    ${Identity.getMbtiBadgeHTML(post.author)}
                    <div class="post-time">${timeAgo(post.createdAt)}</div>
                </div>
            </div>
            <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
            <p class="post-card-content">${escapeHtml(post.content)}</p>
            ${post.image ? `<div class="post-card-image"><img src="${post.image}" alt="帖子图片" loading="lazy"></div>` : ''}
            <div class="post-card-footer">
                <div class="post-tags">
                    ${Channels.getBadgeHTML(post.channel)}
                    ${post.mood ? Moods.getBadgeHTML(post.mood) : ''}
                    ${post.tags.map(t => `<span class="post-tag">${t}</span>`).join('')}
                </div>
                <div class="post-stats">
                    <span class="post-stat" onclick="event.stopPropagation();handleLike('${post.id}',this)">
                        <svg viewBox="0 0 24 24" fill="${Posts.isLiked(post.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span class="like-count">${post.likes.length}</span>
                    </span>
                    <span class="post-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ${post.comments.length}
                    </span>
                </div>
            </div>
        </article>
    `;
    }).join('');
}

// ===== 发帖页渲染 =====
function renderCreatePage() {
    const me = Identity.getMe();
    const roleBadge = Roles.getBadgeHTML(me.role);
    document.getElementById('myIdentity').innerHTML = `
        ${Identity.getAvatarHTML(me, 36)}
        <span>你将以 <strong>${me.name}</strong> ${roleBadge} 的身份匿名发布</span>
    `;
    document.getElementById('postForm').reset();
    document.getElementById('contentCount').textContent = '0';
    removeImage();
}

// ===== 帖子详情页渲染 =====
function renderPostDetail(postId) {
    const post = Posts.getById(postId);
    if (!post) {
        navigate('home');
        return;
    }

    const isLiked = Posts.isLiked(postId);
    const container = document.getElementById('postDetail');

    // 审核警告
    let auditWarning = '';
    if (post.auditStatus === 'pending') {
        auditWarning = '<div class="content-warning">⚠️ 该帖子正在审核中，部分内容可能不可见</div>';
    }

    container.innerHTML = `
        <button class="detail-back" onclick="navigate('home')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
            返回
        </button>

        ${auditWarning}

        <div class="detail-header">
            <h1 class="detail-title">${escapeHtml(post.title)}</h1>
            <div class="detail-meta">
                <div class="detail-author">
                    ${Identity.getAvatarHTML(post.author)}
                    ${Identity.getNameHTML(post.author)}
                    ${Roles.getBadgeHTML(post.author.role)}
                    ${Identity.getMbtiBadgeHTML(post.author)}
                    ${post.show_vein ? `<span class="vein-badge" title="叶脉号">🌿 ${escapeHtml(RemoteUser.getVeinId() || '')}</span>` : ''}
                </div>
                <span class="detail-time">${timeAgo(post.createdAt)}</span>
            </div>
        </div>

        <div class="detail-content">${escapeHtml(post.content)}</div>

        ${post.image ? `<div class="detail-image"><img src="${post.image}" alt="帖子图片"></div>` : ''}

        <div class="detail-tags">
            ${Channels.getBadgeHTML(post.channel)}
            ${post.mood ? Moods.getBadgeHTML(post.mood) : ''}
            ${post.tags.map(t => `<span class="post-tag">${t}</span>`).join('')}
        </div>

        <div class="detail-actions">
            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="handleLikeDetail('${post.id}', this)">
                <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${post.likes.length} 赞
            </button>
            <button class="action-btn" onclick="openDmModal('${post.author.id}', '${escapeHtml(post.author.name).replace(/'/g, "\\'")}', '${post.author.color}', '${post.author.mbti || ''}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                私信
            </button>
            <button class="report-btn" onclick="openReportModal('${post.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                举报
            </button>
        </div>

        <!-- 情绪反应栏 -->
        <div class="reaction-bar" id="reactionBar">
            <span class="reaction-label">读完我的感受：</span>
            <div class="reaction-buttons">
                ${renderReactionButtons(post)}
            </div>
            <div class="reaction-summary" id="reactionSummary">
                ${renderReactionSummary(post)}
            </div>
        </div>

        <div class="comments-section">
            <h3>评论 (${post.comments.length})</h3>
            <div class="comment-form">
                ${Identity.getAvatarHTML(Identity.getMe(), 36)}
                <div class="comment-input-wrap">
                    <textarea id="commentInput" placeholder="写下你的评论..." rows="2" maxlength="500" oninput="document.getElementById('commentCharCount').textContent=this.value.length"></textarea>
                    <div class="comment-input-actions">
                        <span class="char-count" id="commentCharCount">0</span>/500
                        <button class="btn-primary btn-sm" onclick="handleComment('${post.id}')">发表评论</button>
                    </div>
                </div>
            </div>
            <div class="comment-list" id="commentList">
                ${post.comments.map(c => renderComment(c)).join('')}
            </div>
        </div>
    `;
}

function renderComment(comment) {
    return `
        <div class="comment-item">
            ${Identity.getAvatarHTML(comment.author, 32)}
            <div class="comment-body">
                <div class="comment-header">
                    ${Identity.getNameHTML(comment.author)}
                    ${Roles.getBadgeHTML(comment.author.role)}
                    ${Identity.getMbtiBadgeHTML(comment.author)}
                    <span class="comment-time">${timeAgo(comment.createdAt)}</span>
                </div>
                <p class="comment-text">${escapeHtml(comment.text)}</p>
            </div>
        </div>
    `;
}

// ===== 私信页渲染 =====
function renderMessages() {
    const convs = Messages.getConversations();
    const listEl = document.getElementById('conversationList');
    const noConv = document.getElementById('noConversations');

    if (convs.length === 0) {
        listEl.innerHTML = '';
        noConv.style.display = 'block';
        document.getElementById('messagesChat').innerHTML = `
            <div class="chat-placeholder">
                <div class="empty-icon">💬</div>
                <p>选择一个对话开始聊天</p>
            </div>
        `;
        return;
    }

    noConv.style.display = 'none';
    const myId = Identity.getMe().id;

    listEl.innerHTML = convs.map(conv => {
        const isOther = conv.participant1 === myId ? conv.participant2Info : conv.participant1Info;
        const lastMsg = conv.messages[conv.messages.length - 1];
        const preview = lastMsg ? (lastMsg.senderId === myId ? '我: ' : '') + lastMsg.text : '暂无消息';
        const isActive = conv.id === currentConvId;
        const compat = Identity.getCompatibility(Identity.getMe().mbti, isOther.mbti);

        return `
            <div class="conversation-item ${isActive ? 'active' : ''}" onclick="openConversation('${conv.id}')">
                ${Identity.getAvatarHTML(isOther)}
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${escapeHtml(isOther.name)}
                        ${Identity.getMbtiBadgeHTML(isOther)}
                    </div>
                    <div class="conversation-preview">${escapeHtml(preview.substring(0, 30))}</div>
                </div>
                <div class="conversation-right">
                    ${compat !== null ? `<span class="compat-score" title="MBTI契合度">${compat}%</span>` : ''}
                    <span class="conversation-time">${lastMsg ? timeAgo(lastMsg.createdAt) : ''}</span>
                </div>
            </div>
        `;
    }).join('');

    if (currentConvId) {
        openConversation(currentConvId);
    }
}

function openConversation(convId) {
    currentConvId = convId;
    const convs = Messages.getAll();
    const conv = convs.find(c => c.id === convId);
    if (!conv) return;

    const myId = Identity.getMe().id;
    const otherInfo = conv.participant1 === myId ? conv.participant2Info : conv.participant1Info;

    Messages.markAsRead(convId);
    updateMsgBadge();

    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    const items = document.querySelectorAll('.conversation-item');
    const convsList = Messages.getConversations();
    convsList.forEach((c, i) => {
        if (c.id === convId && items[i]) items[i].classList.add('active');
    });

    const chatEl = document.getElementById('messagesChat');
    const compat = Identity.getCompatibility(Identity.getMe().mbti, otherInfo.mbti);
    chatEl.innerHTML = `
        <div class="chat-header">
            <button class="chat-back-btn" onclick="closeDmChatMobile()" title="返回">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            ${Identity.getAvatarHTML(otherInfo, 36)}
            <div class="chat-header-info">
                <span class="chat-header-name">${escapeHtml(otherInfo.name)}</span>
                ${Identity.getMbtiBadgeHTML(otherInfo)}
            </div>
        </div>
        ${compat !== null ? `
        <div class="mbti-compat">
            <span>🤝 MBTI 契合度</span>
            <div class="mbti-compat-bar"><div class="mbti-compat-fill" style="width:${compat}%"></div></div>
            <span>${compat}%</span>
        </div>` : ''}
        <div class="chat-messages" id="chatMessages">
            ${conv.messages.map(m => `
                <div class="chat-bubble ${m.senderId === myId ? 'sent' : 'received'}">
                    ${escapeHtml(m.text)}
                    <div class="chat-bubble-time">${timeAgo(m.createdAt)}</div>
                </div>
            `).join('')}
        </div>
        <div class="chat-input-bar">
            <input type="text" id="chatInput" placeholder="输入消息..." onkeydown="if(event.key==='Enter')sendChatMessage()" maxlength="500">
            <button class="btn-primary" onclick="sendChatMessage()">发送</button>
        </div>
    `;

    // 移动端：全屏显示聊天区域
    chatEl.classList.add('active');

    setTimeout(() => {
        const chatMsgs = document.getElementById('chatMessages');
        if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }, 50);
}

function closeDmChatMobile() {
    const chatEl = document.getElementById('messagesChat');
    if (chatEl) chatEl.classList.remove('active');
}

function sendChatMessage() {
    if (window._isSendingChat) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !currentConvId) return;
    window._isSendingChat = true;

    const convs = Messages.getAll();
    const conv = convs.find(c => c.id === currentConvId);
    if (!conv) return;

    const myId = Identity.getMe().id;
    conv.messages.push({
        id: 'm_' + Date.now().toString(36),
        senderId: myId,
        text,
        createdAt: Date.now()
    });
    conv.updatedAt = Date.now();
    Messages.save(convs);

    input.value = '';
    openConversation(currentConvId);
    renderMessages();
    setTimeout(() => { window._isSendingChat = false; }, 1000);
}

// ===== 频道筛选 =====
function filterByChannel(channel) {
    currentChannel = channel;
    document.querySelectorAll('.filter-chip[data-channel]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.channel === channel);
    });
    renderPostList();
}

// ===== 事件处理 =====

let searchTimeout;
let searchResultUser = null; // 搜索到的用户卡片

function handleSearch(value) {
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) clearBtn.style.display = value.trim() ? 'flex' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        currentSearch = value.trim();
        searchResultUser = null;

        // 检测是否为叶脉号（7位大写字母+数字）
        const veinIdPattern = /^[A-Z0-9]{7}$/;
        if (veinIdPattern.test(currentSearch)) {
            const user = await RemoteUser.findByVeinId(currentSearch);
            if (user) {
                searchResultUser = user;
                renderSearchUserCard(user);
                return;
            }
        }

        // 清除用户卡片
        const existingCard = document.getElementById('searchUserCard');
        if (existingCard) existingCard.remove();

        if (currentPage === 'home') renderPostList();
    }, 300);
}

function renderSearchUserCard(user) {
    // 移除旧卡片
    const existingCard = document.getElementById('searchUserCard');
    if (existingCard) existingCard.remove();

    if (!user.allow_find) {
        const card = document.createElement('div');
        card.id = 'searchUserCard';
        card.className = 'search-user-card';
        card.innerHTML = `
            <div class="search-user-card-inner">
                <div class="search-user-not-found">
                    <span class="search-user-icon">🔒</span>
                    <p>该用户未开放叶脉号查找</p>
                </div>
            </div>
        `;
        document.getElementById('postList').before(card);
        return;
    }

    const mbtiInfo = user.mbti ? Identity.mbtiInfo[user.mbti] : null;
    const card = document.createElement('div');
    card.id = 'searchUserCard';
    card.className = 'search-user-card';
    card.innerHTML = `
        <div class="search-user-card-inner">
            <div class="search-user-avatar" style="background:${user.avatar_color || '#5b8c6e'};width:48px;height:48px;font-size:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white">
                ${user.avatar_emoji || user.nickname?.charAt(0) || '?'}
            </div>
            <div class="search-user-info">
                <div class="search-user-name">${escapeHtml(user.nickname || '匿名用户')}</div>
                <div class="search-user-vein">叶脉号：${escapeHtml(user.veinId || '')}</div>
                ${mbtiInfo ? `<div class="search-user-mbti">${mbtiInfo.emoji} ${user.mbti}</div>` : ''}
            </div>
            <div class="search-user-actions">
                <button class="btn-primary btn-sm" onclick="openDmToRemoteUser('${user.userId}', '${escapeHtml(user.nickname || '匿名用户').replace(/'/g, "\\'")}', '${user.avatar_color || '#5b8c6e'}', '${user.mbti || ''}')">写信</button>
                <button class="btn-ghost btn-sm" onclick="openDmToRemoteUser('${user.userId}', '${escapeHtml(user.nickname || '匿名用户').replace(/'/g, "\\'")}', '${user.avatar_color || '#5b8c6e'}', '${user.mbti || ''}');navigate('messages')">私信</button>
            </div>
        </div>
    `;
    document.getElementById('postList').before(card);
}

function openDmToRemoteUser(remoteUserId, name, color, mbti) {
    // 缓存远程 userId 映射
    const localId = 'remote_' + remoteUserId;
    DB.set('remoteUserId_' + localId, remoteUserId);
    openDmModal(localId, name, color, mbti);
}

function clearSearch() {
    currentSearch = '';
    searchResultUser = null;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    // 清除用户卡片
    const existingCard = document.getElementById('searchUserCard');
    if (existingCard) existingCard.remove();
    renderPostList();
    if (searchInput) searchInput.focus();
}

function filterByTag(tag) {
    currentTag = tag;
    document.querySelectorAll('.filter-chip[data-tag]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === tag);
    });
    renderPostList();
}

function handleSort(value) {
    currentSort = value;
    renderPostList();
}

function handleLike(postId, el) {
    const liked = Posts.toggleLike(postId);
    const svg = el.querySelector('svg');
    if (liked) {
        svg.setAttribute('fill', 'currentColor');
        el.style.color = 'var(--accent)';
    } else {
        svg.setAttribute('fill', 'none');
        el.style.color = '';
    }
    const count = Posts.getById(postId).likes.length;
    el.querySelector('.like-count').textContent = count;
}

function handleLikeDetail(postId, btn) {
    const liked = Posts.toggleLike(postId);
    const post = Posts.getById(postId);
    const svg = btn.querySelector('svg');
    if (liked) {
        btn.classList.add('liked');
        svg.setAttribute('fill', 'currentColor');
    } else {
        btn.classList.remove('liked');
        svg.setAttribute('fill', 'none');
    }
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        ${post.likes.length} 赞
    `;
}

function handleComment(postId) {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text) return;

    const comment = Posts.addComment(postId, text);
    if (comment) {
        input.value = '';
        document.getElementById('commentCharCount').textContent = '0';
        const list = document.getElementById('commentList');
        list.insertAdjacentHTML('beforeend', renderComment(comment));
        const newEl = list.lastElementChild;
        newEl.classList.add('new-comment');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => newEl.classList.remove('new-comment'), 400);
        showToast('评论成功');
    }
}

// 发帖（含审核）
let cancelCreateConfirm = false;

function handleCancelCreate() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const hasImage = uploadedImage !== null;

    if (!cancelCreateConfirm && (title || content || hasImage)) {
        cancelCreateConfirm = true;
        showToast('你还有未发布的内容，再次点击确认离开');
        setTimeout(() => { cancelCreateConfirm = false; }, 3000);
        return;
    }

    cancelCreateConfirm = false;
    navigate('home');
}

function handleCreatePost(event) {
    event.preventDefault();
    if (window._isSubmittingPost) return;
    window._isSubmittingPost = true;

    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const tags = Array.from(document.querySelectorAll('#tagSelect input:checked')).map(cb => cb.value);
    const channelEl = document.querySelector('#channelSelect input:checked');
    const channel = channelEl ? channelEl.value : '树洞';
    const moodEl = document.querySelector('#moodSelect input:checked');
    const mood = moodEl ? moodEl.value : null;
    const showVeinEl = document.getElementById('showVeinToggle');
    const showVein = showVeinEl ? (showVeinEl.checked ? 1 : 0) : 1;

    if (!title || !content) {
        showToast('请填写标题和内容');
        window._isSubmittingPost = false;
        return;
    }

    // AI 内容审核
    const audit = ContentAudit.auditPost(title, content);
    if (!audit.passed) {
        showToast('内容未通过审核：' + audit.warnings[0]);
        window._isSubmittingPost = false;
        return;
    }

    const post = Posts.create({
        title,
        content,
        tags,
        channel,
        mood,
        image: uploadedImage,
        show_vein: showVein
    });

    showToast('发布成功！');
    uploadedImage = null;
    navigate('detail', { postId: post.id });
    setTimeout(() => { window._isSubmittingPost = false; }, 1000);
}

// 字数统计
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('postContent');
    if (textarea) {
        textarea.addEventListener('input', () => {
            document.getElementById('contentCount').textContent = textarea.value.length;
        });
    }
});

// 图片上传
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过 2MB');
        return;
    }

    try { localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); } catch(e) { showToast('存储空间不足，请删除一些旧帖子'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImage = e.target.result;
        document.getElementById('previewImg').src = uploadedImage;
        document.getElementById('imagePreview').style.display = 'block';
        document.querySelector('.upload-area').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    uploadedImage = null;
    document.getElementById('previewImg').src = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.querySelector('.upload-area').style.display = '';
    document.getElementById('imageInput').value = '';
}

// ===== 举报系统 =====
function openReportModal(postId) {
    reportTargetPostId = postId;
    document.getElementById('reportDetail').value = '';
    document.querySelectorAll('#reportModal input[name="reportReason"]')[0].checked = true;
    document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
    reportTargetPostId = null;
}

function submitReport() {
    if (!reportTargetPostId) return;

    const reasonEl = document.querySelector('#reportModal input[name="reportReason"]:checked');
    const reason = reasonEl ? reasonEl.value : 'other';
    const detail = document.getElementById('reportDetail').value.trim();

    Posts.report(reportTargetPostId, reason, detail);
    closeReportModal();
    showToast('举报已提交，感谢你的反馈');

    // 刷新详情页
    if (currentPostId) {
        renderPostDetail(currentPostId);
    }
}

// ===== 随机发现系统 =====
function openRandomDiscover() {
    document.getElementById('discoverModal').style.display = 'flex';
    loadNextDiscover();
}

function closeDiscoverModal() {
    document.getElementById('discoverModal').style.display = 'none';
    currentDiscoverPostId = null;
    // 重置卡片
    const card = document.getElementById('discoverCard');
    if (card) card.classList.remove('flipped');
    document.getElementById('discoverViewBtn').style.display = 'none';
}

function loadNextDiscover() {
    const posts = Posts.getAll().filter(p => p.auditStatus !== 'rejected');
    if (posts.length === 0) {
        document.getElementById('discoverBody').innerHTML = `
            <div class="discover-empty">
                <div class="empty-icon">📭</div>
                <p>暂无帖子可发现</p>
            </div>
        `;
        return;
    }

    // 随机选一个
    if (currentDiscoverPostId && posts.length > 1) {
        posts = posts.filter(p => p.id !== currentDiscoverPostId);
    }
    const randomPost = posts[Math.floor(Math.random() * posts.length)];
    currentDiscoverPostId = randomPost.id;

    // 重置翻转
    const card = document.getElementById('discoverCard');
    card.classList.remove('flipped');
    document.getElementById('discoverViewBtn').style.display = 'none';

    // 渲染正面
    const moodEmoji = randomPost.mood ? Moods.map[randomPost.mood] : '🌿';
    document.getElementById('discoverFront').innerHTML = `
        <div class="discover-mood">${moodEmoji}</div>
        <div class="discover-preview-title">${escapeHtml(randomPost.title)}</div>
        <div class="discover-preview-snippet">${escapeHtml(randomPost.content)}</div>
        <div class="discover-tap-hint">👆 点击翻转查看完整内容</div>
    `;

    // 渲染背面
    document.getElementById('discoverBack').innerHTML = `
        <div class="discover-full-meta">
            ${Channels.getBadgeHTML(randomPost.channel)}
            ${randomPost.mood ? Moods.getBadgeHTML(randomPost.mood) : ''}
            ${randomPost.tags.map(t => `<span class="post-tag">${t}</span>`).join('')}
        </div>
        <div class="discover-full-content">${escapeHtml(randomPost.content)}</div>
    `;

    // 点击翻转
    card.onclick = () => {
        card.classList.toggle('flipped');
        if (card.classList.contains('flipped')) {
            document.getElementById('discoverViewBtn').style.display = 'inline-flex';
        } else {
            document.getElementById('discoverViewBtn').style.display = 'none';
        }
    };
}

function viewDiscoverPost() {
    if (!currentDiscoverPostId) return;
    const postId = currentDiscoverPostId; // 先保存，closeDiscoverModal 会清空
    closeDiscoverModal();
    navigate('detail', { postId });
}

// ===== 角色选择 =====
function confirmRole() {
    const roleEl = document.querySelector('#roleModal input[name="role"]:checked');
    if (!roleEl) {
        showToast('请选择一个角色');
        return;
    }
    Roles.setRole(roleEl.value);
    document.getElementById('roleModal').style.display = 'none';
    showToast('角色设置成功！');
    // 刷新当前页面
    navigate(currentPage);
}

// ===== 私信模态框 =====
function openDmModal(targetId, targetName, targetColor, targetMbti) {
    if (targetId === Identity.getMe().id) {
        showToast('不能给自己发私信哦');
        return;
    }
    dmTarget = { id: targetId, name: targetName, color: targetColor, mbti: targetMbti || null };
    document.getElementById('dmMessage').value = '';
    document.getElementById('dmModal').style.display = 'flex';
}

function closeDmModal() {
    document.getElementById('dmModal').style.display = 'none';
    dmTarget = null;
}

function sendDirectMessage() {
    if (window._isSendingDm) return;
    const text = document.getElementById('dmMessage').value.trim();
    if (!text) { showToast('请输入消息内容'); return; }
    if (!dmTarget) return;
    window._isSendingDm = true;

    Messages.send(dmTarget.id, dmTarget.name, dmTarget.color, text, dmTarget.mbti);
    closeDmModal();
    showToast('私信已发送');
    updateMsgBadge();
    setTimeout(() => { window._isSendingDm = false; }, 1000);

    if (currentPage === 'messages') {
        const conv = Messages.getConversation(dmTarget.id);
        if (conv) {
            currentConvId = conv.id;
            renderMessages();
            openConversation(conv.id);
        }
    }
}

// ===== 树洞日记 =====
const Diary = {
    getAll() {
        return DB.get('diaries') || [];
    },
    save(diaries) {
        DB.set('diaries', diaries);
    },
    create(data) {
        const diaries = this.getAll();
        const diary = {
            id: 'diary_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            date: data.date || new Date().toISOString().split('T')[0],
            content: data.content,
            mood: data.mood || '',
            isPublic: data.isPublic || false,
            createdAt: Date.now()
        };
        diaries.unshift(diary);
        this.save(diaries);
        return diary;
    },
    update(id, data) {
        const diaries = this.getAll();
        const idx = diaries.findIndex(d => d.id === id);
        if (idx !== -1) {
            diaries[idx] = { ...diaries[idx], ...data };
            this.save(diaries);
        }
    },
    delete(id) {
        const diaries = this.getAll().filter(d => d.id !== id);
        this.save(diaries);
    },
    getByDate(date) {
        return this.getAll().filter(d => d.date === date);
    },
    getPublicDiaries() {
        return this.getAll().filter(d => d.isPublic);
    }
};

let diaryCalMonth, diaryCalYear;
let editingDiaryId = null;
let selectedDiaryMood = '';

function renderDiaryPage() {
    const now = new Date();
    diaryCalMonth = now.getMonth();
    diaryCalYear = now.getFullYear();
    renderDiaryCalendar();
    renderDiaryList();
}

function renderDiaryCalendar() {
    const cal = document.getElementById('diaryCalendar');
    if (!cal) return;
    
    const diaries = Diary.getAll();
    const diaryDates = new Set(diaries.map(d => d.date));
    
    const firstDay = new Date(diaryCalYear, diaryCalMonth, 1).getDay();
    const daysInMonth = new Date(diaryCalYear, diaryCalMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(diaryCalYear, diaryCalMonth, 0).getDate();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let html = `
        <div class="diary-cal-header">
            <button class="diary-cal-nav" onclick="changeDiaryMonth(-1)">&#8249;</button>
            <span>${diaryCalYear}年 ${monthNames[diaryCalMonth]}</span>
            <button class="diary-cal-nav" onclick="changeDiaryMonth(1)">&#8250;</button>
        </div>
    `;
    
    weekdays.forEach(w => {
        html += `<div class="diary-cal-weekday">${w}</div>`;
    });
    
    // 上月填充
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="diary-cal-day other-month">${daysInPrevMonth - i}</div>`;
    }
    
    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${diaryCalYear}-${String(diaryCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const hasDiary = diaryDates.has(dateStr);
        html += `<div class="diary-cal-day ${isToday ? 'today' : ''} ${hasDiary ? 'has-diary' : ''}" onclick="viewDiaryByDate('${dateStr}')">${d}</div>`;
    }
    
    // 下月填充
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="diary-cal-day other-month">${i}</div>`;
    }
    
    cal.innerHTML = html;
}

function changeDiaryMonth(delta) {
    diaryCalMonth += delta;
    if (diaryCalMonth > 11) { diaryCalMonth = 0; diaryCalYear++; }
    if (diaryCalMonth < 0) { diaryCalMonth = 11; diaryCalYear--; }
    renderDiaryCalendar();
}

function renderDiaryList() {
    const list = document.getElementById('diaryList');
    if (!list) return;
    
    const diaries = Diary.getAll();
    if (diaries.length === 0) {
        list.innerHTML = `
            <div class="diary-empty">
                <div class="diary-empty-icon">📔</div>
                <p>还没有日记</p>
                <p style="font-size:13px;margin-top:4px">点击右下角开始记录</p>
            </div>
        `;
        return;
    }
    
    const moodEmojis = { '开心': '😊', '平静': '😌', '感动': '🥹', '焦虑': '😰', '难过': '😢', '愤怒': '😤', '迷茫': '🌫️', '期待': '✨' };
    
    list.innerHTML = diaries.slice(0, 20).map(d => `
        <div class="diary-item" onclick="viewDiary('${d.id}')">
            <div class="diary-item-header">
                <span class="diary-item-date">${d.date}</span>
                <span class="diary-item-mood">${moodEmojis[d.mood] || ''}</span>
            </div>
            <div class="diary-item-preview">${escapeHtml(d.content)}</div>
            <div class="diary-item-visibility">${d.isPublic ? '🌐 已公开' : '🔒 私密'}</div>
        </div>
    `).join('');
}

function openDiaryEditor(diaryId) {
    editingDiaryId = diaryId || null;
    selectedDiaryMood = '';

    const modal = document.getElementById('diaryEditorModal');
    const dateInput = document.getElementById('diaryDateInput');
    const contentEl = document.getElementById('diaryContent');
    const publicEl = document.getElementById('diaryPublic');

    if (diaryId) {
        const diary = Diary.getAll().find(d => d.id === diaryId);
        if (diary) {
            // 解析日期，支持带时间或不带时间
            const dt = diary.date.includes('T') ? diary.date : diary.date + 'T00:00';
            dateInput.value = dt.slice(0, 16);
            contentEl.value = diary.content;
            selectedDiaryMood = diary.mood;
            publicEl.checked = diary.isPublic;
        }
    } else {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const local = new Date(now - offset);
        dateInput.value = local.toISOString().slice(0, 16);
        contentEl.value = '';
        publicEl.checked = false;
    }
    
    // 渲染心情选项
    const moods = ['开心', '平静', '感动', '焦虑', '难过', '愤怒', '迷茫', '期待'];
    const moodEmojis = { '开心': '😊', '平静': '😌', '感动': '🥹', '焦虑': '😰', '难过': '😢', '愤怒': '😤', '迷茫': '🌫️', '期待': '✨' };
    document.getElementById('diaryMoodOptions').innerHTML = moods.map(m => 
        `<button class="diary-mood-btn ${selectedDiaryMood === m ? 'active' : ''}" onclick="selectDiaryMood('${m}', this)">${moodEmojis[m]} ${m}</button>`
    ).join('');
    
    modal.style.display = 'flex';
}

function closeDiaryEditor() {
    document.getElementById('diaryEditorModal').style.display = 'none';
    editingDiaryId = null;
}

function selectDiaryMood(mood, el) {
    selectedDiaryMood = mood;
    document.querySelectorAll('.diary-mood-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

function saveDiary() {
    const content = document.getElementById('diaryContent').value.trim();
    if (!content) { showToast('请写点什么吧'); return; }

    const isPublic = document.getElementById('diaryPublic').checked;
    const dateInput = document.getElementById('diaryDateInput');
    const dateVal = dateInput.value;
    // 格式化为 YYYY-MM-DD HH:mm 用于显示
    const date = dateVal ? dateVal.replace('T', ' ') : new Date().toISOString().split('T')[0];
    
    if (editingDiaryId) {
        Diary.update(editingDiaryId, { content, mood: selectedDiaryMood, isPublic });
        showToast('日记已更新');
    } else {
        Diary.create({ date, content, mood: selectedDiaryMood, isPublic });
        showToast('日记已保存');
    }
    
    closeDiaryEditor();
    renderDiaryCalendar();
    renderDiaryList();
}

function viewDiary(id) {
    const diary = Diary.getAll().find(d => d.id === id);
    if (!diary) return;
    
    const moodEmojis = { '开心': '😊', '平静': '😌', '感动': '🥹', '焦虑': '😰', '难过': '😢', '愤怒': '😤', '迷茫': '🌫️', '期待': '✨' };
    
    document.getElementById('diaryViewDate').textContent = diary.date;
    document.getElementById('diaryViewBody').innerHTML = `
        <div class="diary-view-mood">${moodEmojis[diary.mood] || ''} ${diary.mood || '未记录心情'}</div>
        <div class="diary-view-text">${escapeHtml(diary.content)}</div>
        <div style="margin-top:20px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-ghost btn-sm" onclick="deleteDiary('${diary.id}')">删除</button>
            <button class="btn-primary btn-sm" onclick="closeDiaryView();openDiaryEditor('${diary.id}')">编辑</button>
        </div>
    `;
    document.getElementById('diaryViewModal').style.display = 'flex';
}

function viewDiaryByDate(dateStr) {
    const diaries = Diary.getByDate(dateStr);
    if (diaries.length > 0) {
        viewDiary(diaries[0].id);
    } else {
        // 直接打开编辑器写当天的日记
        editingDiaryId = null;
        openDiaryEditor();
        const dateInput = document.getElementById('diaryDateInput');
        if (dateInput) {
            const now = new Date(dateStr);
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}T09:00`;
        }
    }
}

function closeDiaryView() {
    document.getElementById('diaryViewModal').style.display = 'none';
}

function deleteDiary(id) {
    Diary.delete(id);
    closeDiaryView();
    renderDiaryCalendar();
    renderDiaryList();
    showToast('日记已删除');
}

// ===== MBTI 系统 =====
let currentMbtiFilter = 'all';

// 初始化 MBTI 下拉选项
function initMbtiSelects() {
    const selects = [document.getElementById('mbtiSelect'), document.getElementById('mbtiFilter')];
    Identity.mbtiTypes.forEach(type => {
        const info = Identity.mbtiInfo[type];
        selects.forEach(sel => {
            if (!sel) return;
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = `${info.emoji} ${type} · ${info.label}`;
            sel.appendChild(opt);
        });
    });
}

function onMbtiChange(value) {
    const me = Identity.getMe();
    me.mbti = value || null;
    DB.set('my_identity', me);
    showToast(value ? `MBTI 已设为 ${value}` : 'MBTI 已清除');
}

function filterByMbti(mbti) {
    currentMbtiFilter = mbti;
    if (currentPage === 'home') renderPostList();
}

// 在帖子列表筛选中加入 MBTI
const _origRenderPostList = renderPostList;
renderPostList = function() {
    // 先调原始逻辑但拦截 posts 过滤
    let posts = Posts.getAll();
    posts = posts.filter(p => p.auditStatus !== 'rejected');

    if (currentSearch) {
        const q = currentSearch.toLowerCase();
        posts = posts.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (currentChannel !== 'all') posts = posts.filter(p => p.channel === currentChannel);
    if (currentTag !== 'all') posts = posts.filter(p => p.tags.includes(currentTag));
    if (currentMbtiFilter !== 'all') posts = posts.filter(p => p.author && p.author.mbti === currentMbtiFilter);

    switch (currentSort) {
        case 'newest': posts.sort((a, b) => b.createdAt - a.createdAt); break;
        case 'popular': posts.sort((a, b) => b.likes.length - a.likes.length); break;
        case 'commented': posts.sort((a, b) => b.comments.length - a.comments.length); break;
    }

    const container = document.getElementById('postList');
    const empty = document.getElementById('emptyState');

    if (posts.length === 0) {
        container.innerHTML = '';
        if (currentSearch) {
            empty.style.display = 'block';
            empty.querySelector('.empty-title').textContent = '没有找到匹配的内容';
            empty.querySelector('.empty-desc').textContent = '试试其他关键词';
            const btn = empty.querySelector('.btn-primary');
            if (btn) {
                btn.textContent = '清除搜索';
                btn.onclick = clearSearch;
            }
        } else {
            empty.style.display = 'block';
            empty.querySelector('.empty-title').textContent = '这片森林还安静着';
            empty.querySelector('.empty-desc').textContent = '种下第一棵树，让故事从这里开始';
            const btn = empty.querySelector('.btn-primary');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 写下第一个故事';
                btn.onclick = function() { navigate('create'); };
            }
        }
        return;
    }

    empty.style.display = 'none';
    // 恢复默认空状态文案
    empty.querySelector('.empty-title').textContent = '这片森林还安静着';
    empty.querySelector('.empty-desc').textContent = '种下第一棵树，让故事从这里开始';
    const resetBtn = empty.querySelector('.btn-primary');
    if (resetBtn) {
        resetBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 写下第一个故事';
        resetBtn.onclick = function() { navigate('create'); };
    }
    container.innerHTML = posts.map((post, i) => {
        const isHot = post.likes.length >= 5 || post.comments.length >= 5;
        return `
        <article class="post-card ${post.auditStatus === 'pending' ? 'audit-pending' : ''} ${isHot ? 'glow' : ''}" data-mood="${post.mood || ''}" style="animation-delay:${i * 0.05}s" onclick="navigate('detail', {postId:'${post.id}'})">
            <div class="post-card-header">
                ${Identity.getAvatarHTML(post.author)}
                <div class="post-meta">
                    ${Identity.getNameHTML(post.author)}
                    ${Roles.getBadgeHTML(post.author.role)}
                    ${Identity.getMbtiBadgeHTML(post.author)}
                    <div class="post-time">${timeAgo(post.createdAt)}</div>
                </div>
            </div>
            <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
            <p class="post-card-content">${escapeHtml(post.content)}</p>
            ${post.image ? `<div class="post-card-image"><img src="${post.image}" alt="帖子图片" loading="lazy"></div>` : ''}
            <div class="post-card-footer">
                <div class="post-tags">
                    ${Channels.getBadgeHTML(post.channel)}
                    ${post.mood ? Moods.getBadgeHTML(post.mood) : ''}
                    ${post.tags.map(t => `<span class="post-tag">${t}</span>`).join('')}
                </div>
                <div class="post-stats">
                    <span class="post-stat" onclick="event.stopPropagation();handleLike('${post.id}',this)">
                        <svg viewBox="0 0 24 24" fill="${Posts.isLiked(post.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        ${post.likes.length}
                    </span>
                    <span class="post-stat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ${post.comments.length}
                    </span>
                </div>
            </div>
        </article>
    `;
    }).join('');
};

// ===== MBTI 测试 =====
const mbtiQuestions = [
    // E vs I（3题）
    {
        dim: 'EI',
        q: '周末到了，你更想…',
        a: { text: '🏠 在家看书追剧，享受独处时光', value: 'I' },
        b: { text: '🎉 约朋友出去逛街吃饭', value: 'E' }
    },
    {
        dim: 'EI',
        q: '参加一个聚会，你通常会…',
        a: { text: '🤫 找个安静的角落，和一两个人深聊', value: 'I' },
        b: { text: '🎤 在人群中穿梭，认识新朋友', value: 'E' }
    },
    {
        dim: 'EI',
        q: '长时间独处之后，你的感受是…',
        a: { text: '🔋 充满了电，感觉很舒服', value: 'I' },
        b: { text: '🫠 有点闷，想出去见见人', value: 'E' }
    },
    // S vs N（3题）
    {
        dim: 'SN',
        q: '做决定时，你更依赖…',
        a: { text: '🧠 直觉和灵感，跟着感觉走', value: 'N' },
        b: { text: '📊 事实和数据，讲究实际依据', value: 'S' }
    },
    {
        dim: 'SN',
        q: '看一部电影，你更在意…',
        a: { text: '🎬 画面、音效、剧情细节', value: 'S' },
        b: { text: '💭 隐喻、主题、背后的深意', value: 'N' }
    },
    {
        dim: 'SN',
        q: '朋友跟你吐槽一件事，你第一反应是…',
        a: { text: '🔍 仔细问清楚具体发生了什么', value: 'S' },
        b: { text: '💭 联想到这件事背后的意义和可能性', value: 'N' }
    },
    // T vs F（3题）
    {
        dim: 'TF',
        q: '朋友遇到困难来找你，你会…',
        a: { text: '🤗 先安慰情绪，陪伴是最重要的', value: 'F' },
        b: { text: '💡 帮TA分析问题，给出解决方案', value: 'T' }
    },
    {
        dim: 'TF',
        q: '团队需要做一个艰难的决定，你更看重…',
        a: { text: '⚖️ 公平和逻辑，即使结果不讨喜', value: 'T' },
        b: { text: '🫂 每个人的感受，尽量照顾到所有人', value: 'F' }
    },
    {
        dim: 'TF',
        q: '别人批评你的时候，你更常…',
        a: { text: '🤔 冷静想想对方说得有没有道理', value: 'T' },
        b: { text: '😔 先觉得难过，然后才去分析', value: 'F' }
    },
    // J vs P（3题）
    {
        dim: 'JP',
        q: '对于旅行计划，你更倾向于…',
        a: { text: '📋 提前规划好行程和住宿', value: 'J' },
        b: { text: '🎒 说走就走，到了再随机应变', value: 'P' }
    },
    {
        dim: 'JP',
        q: '你的书桌/房间通常是什么状态？',
        a: { text: '🧹 整整齐齐，东西都有固定位置', value: 'J' },
        b: { text: '🌀 有点乱但我知道东西在哪', value: 'P' }
    },
    {
        dim: 'JP',
        q: '面对一个截止日期，你通常…',
        a: { text: '📅 提前完成，留出缓冲时间', value: 'J' },
        b: { text: '⏰ 最后一刻爆发，deadline是第一生产力', value: 'P' }
    }
];

let mbtiTestStep = 0;
let mbtiVotes = { EI: { E: 0, I: 0 }, SN: { S: 0, N: 0 }, TF: { T: 0, F: 0 }, JP: { J: 0, P: 0 } };

function openMbtiTest() {
    // 检查是否有保存的进度
    const savedProgress = DB.get('mbti_test_progress');
    if (savedProgress) {
        mbtiTestStep = savedProgress.step;
        mbtiVotes = savedProgress.votes;
    } else {
        mbtiTestStep = 0;
        mbtiVotes = { EI: { E: 0, I: 0 }, SN: { S: 0, N: 0 }, TF: { T: 0, F: 0 }, JP: { J: 0, P: 0 } };
    }
    document.getElementById('mbtiTestModal').style.display = 'flex';
    renderMbtiQuestion();
}

function closeMbtiTest() {
    document.getElementById('mbtiTestModal').style.display = 'none';
}

function renderMbtiQuestion() {
    const body = document.getElementById('mbtiTestBody');
    if (mbtiTestStep >= mbtiQuestions.length) {
        renderMbtiResult();
        return;
    }

    const q = mbtiQuestions[mbtiTestStep];
    const total = mbtiQuestions.length;
    const pct = Math.round(((mbtiTestStep) / total) * 100);

    const dimLabels = { EI: '能量来源', SN: '认知方式', TF: '决策方式', JP: '生活态度' };
    const dimLabel = dimLabels[q.dim] || '';

    body.innerHTML = `
        <div class="mbti-progress-info">
            <span>${mbtiTestStep + 1} / ${total}</span>
            <span>${dimLabel}</span>
            <span>${pct}%</span>
        </div>
        <div class="mbti-progress">
            <div class="mbti-progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="mbti-question">${q.q}</div>
        <div class="mbti-options">
            <div class="mbti-option" onclick="answerMbti('${q.a.value}')">${q.a.text}</div>
            <div class="mbti-option" onclick="answerMbti('${q.b.value}')">${q.b.text}</div>
        </div>
    `;
}

function answerMbti(value) {
    const q = mbtiQuestions[mbtiTestStep];
    mbtiVotes[q.dim][value]++;
    mbtiTestStep++;
    DB.set('mbti_test_progress', { step: mbtiTestStep, votes: mbtiVotes });
    renderMbtiQuestion();
}

function renderMbtiResult() {
    DB.remove('mbti_test_progress');
    // 每个维度取票数多的
    const getWinner = (dim) => {
        const v = mbtiVotes[dim];
        const [a, b] = Object.keys(v);
        return v[a] >= v[b] ? a : b;
    };
    const type = getWinner('EI') + getWinner('SN') + getWinner('TF') + getWinner('JP');
    const info = Identity.mbtiInfo[type];
    const body = document.getElementById('mbtiTestBody');

    // 各维度倾向百分比
    const dims = [
        { label: '外向 E ← → 内向 I', a: 'E', b: 'I', va: mbtiVotes.EI.E, vb: mbtiVotes.EI.I },
        { label: '实感 S ← → 直觉 N', a: 'S', b: 'N', va: mbtiVotes.SN.S, vb: mbtiVotes.SN.N },
        { label: '思考 T ← → 情感 F', a: 'T', b: 'F', va: mbtiVotes.TF.T, vb: mbtiVotes.TF.F },
        { label: '计划 J ← → 灵活 P', a: 'J', b: 'P', va: mbtiVotes.JP.J, vb: mbtiVotes.JP.P },
    ];
    const dimBars = dims.map(d => {
        const total = d.va + d.vb;
        const pctA = total ? Math.round((d.va / total) * 100) : 50;
        return `
        <div class="mbti-dim-result">
            <span class="mbti-dim-label">${d.label}</span>
            <div class="mbti-dim-bar">
                <div class="mbti-dim-fill" style="width:${pctA}%"></div>
            </div>
            <span class="mbti-dim-pct">${pctA}% : ${100 - pctA}%</span>
        </div>`;
    }).join('');

    const descriptions = {
        'INTJ': '独立思考的战略家，善于制定长远计划。内心世界丰富，对知识和能力有极高追求。看似冷静，实则对在乎的人非常忠诚。',
        'INTP': '充满好奇心的探索者，喜欢分析问题的本质。思维灵活，享受智力上的挑战。经常沉浸在自己的思考世界里。',
        'ENTJ': '天生的领导者，果断高效。善于组织资源达成目标，有强烈的成就驱动力。在混乱中总能找到方向。',
        'ENTP': '创意无限的发明家，喜欢挑战传统。思维跳跃，善于发现新的可能性。辩论对他们来说是一种享受。',
        'INFJ': '理想主义的守护者，洞察力极强。追求有意义的人生，渴望理解他人内心。是最稀有的人格类型之一。',
        'INFP': '浪漫的理想主义者，内心世界丰富。追求真实和美好，有强烈的价值观。看似安静，内心却有坚定的信念。',
        'ENFJ': '温暖的天生导师，善于激励他人。对人际关系敏感，乐于帮助他人成长。是天生的倾听者和引路人。',
        'ENFP': '热情洋溢的自由灵魂，创造力丰富。对生活充满好奇，善于感染周围的人。总能发现生活中有趣的一面。',
        'ISTJ': '可靠务实的守护者，责任感极强。注重传统和秩序，是值得信赖的人。说到做到，从不让人失望。',
        'ISFJ': '温暖体贴的守护者，默默付出。善于照顾他人，对细节有敏锐的观察力。是最靠谱的朋友类型。',
        'ESTJ': '高效务实的组织者，善于管理。重视规则和效率，是天生的执行者。有他们在，一切井井有条。',
        'ESFJ': '热心周到的照顾者，善于营造和谐。重视人际关系，乐于为他人服务。总能让身边的人感到温暖。',
        'ISTP': '冷静灵活的实践者，善于动手。理性分析问题，享受解决实际难题。危机时刻最靠得住的人。',
        'ISFP': '温和敏感的艺术家，活在当下。追求美和和谐，有独特的审美和价值观。用行动而非言语表达爱。',
        'ESTP': '大胆冒险的行动派，精力充沛。善于把握机会，享受刺激和挑战。生活对他们来说就是一场冒险。',
        'ESFP': '活泼开朗的表演者，热爱生活。善于享受当下，是天生的氛围制造者。有他们在永远不会无聊。'
    };

    body.innerHTML = `
        <div class="mbti-result">
            <div class="mbti-result-type">${type}</div>
            <div class="mbti-result-label">${info.emoji} ${info.label}</div>
            <div class="mbti-result-group">${info.group === 'NT' ? '分析师' : info.group === 'NF' ? '外交家' : info.group === 'SJ' ? '守护者' : '探险家'}</div>
            <div class="mbti-dim-bars">${dimBars}</div>
            <div class="mbti-result-desc">${descriptions[type] || ''}</div>
            <div class="mbti-result-actions">
                <button class="btn-primary" onclick="applyMbtiResult('${type}')">设为我的 MBTI</button>
                <button class="btn-ghost" onclick="openMbtiTest()">重新测试</button>
            </div>
        </div>
    `;
}

function applyMbtiResult(type) {
    DB.remove('mbti_test_progress');
    const me = Identity.getMe();
    me.mbti = type;
    DB.set('my_identity', me);
    closeMbtiTest();
    showToast(`MBTI 已设为 ${type}`);
    // 如果设置面板打开则刷新
    const sel = document.getElementById('mbtiSelect');
    if (sel) sel.value = type;
}

// ===== 关于我们 =====
function openAboutModal() {
    document.getElementById('aboutModal').style.display = 'flex';
}

function closeAboutModal() {
    document.getElementById('aboutModal').style.display = 'none';
}

// ===== 主题系统 =====
const themes = ['light', 'dark', 'starry', 'sakura', 'sunny'];
const themeNames = { light: '月光森林', dark: '暗夜森林', starry: '星空', sakura: '樱花', sunny: '暖阳' };
const themeDots = {
    light: 'linear-gradient(135deg, #f8f6f1, #5b8c6e)',
    dark: 'linear-gradient(135deg, #1c1b18, #6fa882)',
    starry: 'linear-gradient(135deg, #0f0f1a, #7b8cde)',
    sakura: 'linear-gradient(135deg, #fdf6f8, #d4728a)',
    sunny: 'linear-gradient(135deg, #faf8f2, #d4944a)'
};

function openThemeModal() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === current);
    });
    document.getElementById('themeModal').style.display = 'flex';
}

function closeThemeModal() {
    document.getElementById('themeModal').style.display = 'none';
}

function selectTheme(theme, el) {
    document.documentElement.setAttribute('data-theme', theme);
    DB.set('theme', theme);
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    updateThemePicker(theme);
    applyThemePattern(theme);
    showToast('主题已切换');
}

// 主题暗纹图案（JS 直接设置，确保生效）
const themePatterns = {
    light: "url(\"data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%236a9e7e' stroke-opacity='0.18' stroke-width='1.1' stroke-linecap='round'%3E%3Cpath d='M80 300 C80 250 88 210 110 185 C130 162 138 135 132 105 C128 85 132 65 145 48'/%3E%3Cpath d='M110 185 C120 172 132 165 148 160'/%3E%3Cpath d='M110 185 C100 170 88 155 72 145'/%3E%3Cpath d='M132 105 C142 92 155 82 170 75'/%3E%3Cpath d='M132 105 C120 95 108 82 95 70'/%3E%3Cpath d='M145 48 C138 40 128 32 118 22'/%3E%3Cpath d='M240 300 C238 260 230 228 215 205 C202 185 196 162 200 138 C202 122 210 105 222 90'/%3E%3Cpath d='M215 205 C225 195 238 188 252 182'/%3E%3Cpath d='M215 205 C205 192 192 178 178 168'/%3E%3C/g%3E%3Cg fill='%236a9e7e' fill-opacity='0.10'%3E%3Cellipse cx='148' cy='158' rx='8' ry='4.5' transform='rotate(-25 148 158)'/%3E%3Cellipse cx='170' cy='73' rx='7' ry='4' transform='rotate(-30 170 73)'/%3E%3Cellipse cx='72' cy='143' rx='7' ry='4' transform='rotate(-20 72 143)'/%3E%3Cellipse cx='95' cy='68' rx='6' ry='3.5' transform='rotate(-25 95 68)'/%3E%3Cellipse cx='118' cy='20' rx='7' ry='4' transform='rotate(-35 118 20)'/%3E%3Cellipse cx='252' cy='180' rx='7' ry='4' transform='rotate(-30 252 180)'/%3E%3Cellipse cx='178' cy='166' rx='6' ry='3.5' transform='rotate(-20 178 166)'/%3E%3Cellipse cx='222' cy='88' rx='7' ry='4' transform='rotate(-35 222 88)'/%3E%3C/g%3E%3C/svg%3E\") repeat",
    dark: "url(\"data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%236fa882' stroke-opacity='0.10' stroke-width='1.1' stroke-linecap='round'%3E%3Cpath d='M80 300 C80 250 88 210 110 185 C130 162 138 135 132 105 C128 85 132 65 145 48'/%3E%3Cpath d='M110 185 C120 172 132 165 148 160'/%3E%3Cpath d='M110 185 C100 170 88 155 72 145'/%3E%3Cpath d='M132 105 C142 92 155 82 170 75'/%3E%3Cpath d='M132 105 C120 95 108 82 95 70'/%3E%3Cpath d='M145 48 C138 40 128 32 118 22'/%3E%3Cpath d='M240 300 C238 260 230 228 215 205 C202 185 196 162 200 138 C202 122 210 105 222 90'/%3E%3Cpath d='M215 205 C225 195 238 188 252 182'/%3E%3Cpath d='M215 205 C205 192 192 178 178 168'/%3E%3C/g%3E%3Cg fill='%236fa882' fill-opacity='0.06'%3E%3Cellipse cx='148' cy='158' rx='8' ry='4.5' transform='rotate(-25 148 158)'/%3E%3Cellipse cx='170' cy='73' rx='7' ry='4' transform='rotate(-30 170 73)'/%3E%3Cellipse cx='72' cy='143' rx='7' ry='4' transform='rotate(-20 72 143)'/%3E%3Cellipse cx='95' cy='68' rx='6' ry='3.5' transform='rotate(-25 95 68)'/%3E%3Cellipse cx='118' cy='20' rx='7' ry='4' transform='rotate(-35 118 20)'/%3E%3Cellipse cx='252' cy='180' rx='7' ry='4' transform='rotate(-30 252 180)'/%3E%3Cellipse cx='178' cy='166' rx='6' ry='3.5' transform='rotate(-20 178 166)'/%3E%3Cellipse cx='222' cy='88' rx='7' ry='4' transform='rotate(-35 222 88)'/%3E%3C/g%3E%3C/svg%3E\") repeat",
    starry: "url(\"data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='25' cy='30' r='1.3' opacity='0.8'/%3E%3Ccircle cx='80' cy='15' r='0.9' opacity='0.5'/%3E%3Ccircle cx='150' cy='45' r='1.6' opacity='0.7'/%3E%3Ccircle cx='45' cy='80' r='0.9' opacity='0.4'/%3E%3Ccircle cx='120' cy='95' r='1.3' opacity='0.6'/%3E%3Ccircle cx='10' cy='130' r='0.7' opacity='0.4'/%3E%3Ccircle cx='170' cy='120' r='1.1' opacity='0.5'/%3E%3Ccircle cx='70' cy='155' r='0.8' opacity='0.4'/%3E%3Ccircle cx='140' cy='170' r='1' opacity='0.5'/%3E%3Ccircle cx='190' cy='80' r='0.7' opacity='0.3'/%3E%3Ccircle cx='30' cy='180' r='0.6' opacity='0.3'/%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='m1' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0'/%3E%3Cstop offset='70%25' stop-color='%23ffffff' stop-opacity='0.15'/%3E%3Cstop offset='100%25' stop-color='%23ffffff' stop-opacity='0.6'/%3E%3C/linearGradient%3E%3ClinearGradient id='m2' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0'/%3E%3Cstop offset='75%25' stop-color='%23ffffff' stop-opacity='0.1'/%3E%3Cstop offset='100%25' stop-color='%23ffffff' stop-opacity='0.45'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg stroke='url(%23m1)' stroke-width='1.5' stroke-linecap='round' fill='none'%3E%3Cpath d='M60 10 Q100 50 160 80'/%3E%3C/g%3E%3Cg stroke='url(%23m2)' stroke-width='1' stroke-linecap='round' fill='none'%3E%3Cpath d='M10 70 Q30 90 55 105'/%3E%3C/g%3E%3C/svg%3E\") repeat",
    sakura: "url(\"data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c05070'%3E%3Cellipse cx='25' cy='20' rx='6' ry='4' opacity='0.5' transform='rotate(30 25 20)'/%3E%3Cellipse cx='80' cy='15' rx='5' ry='3' opacity='0.4' transform='rotate(-20 80 15)'/%3E%3Cellipse cx='55' cy='50' rx='7' ry='4.5' opacity='0.45' transform='rotate(50 55 50)'/%3E%3Cellipse cx='15' cy='75' rx='5' ry='3.5' opacity='0.35' transform='rotate(-35 15 75)'/%3E%3Cellipse cx='95' cy='65' rx='6' ry='4' opacity='0.4' transform='rotate(15 95 65)'/%3E%3Cellipse cx='40' cy='95' rx='5' ry='3' opacity='0.35' transform='rotate(40 40 95)'/%3E%3Cellipse cx='105' cy='100' rx='4' ry='2.5' opacity='0.3' transform='rotate(-25 105 100)'/%3E%3Ccircle cx='25' cy='20' r='1.5' fill='%23e08090' opacity='0.5'/%3E%3Ccircle cx='55' cy='50' r='1.8' fill='%23e08090' opacity='0.45'/%3E%3Ccircle cx='95' cy='65' r='1.5' fill='%23e08090' opacity='0.4'/%3E%3C/svg%3E\") repeat",
    sunny: "url(\"data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CradialGradient id='glow'%3E%3Cstop offset='0%25' stop-color='%23d4944a' stop-opacity='0.18'/%3E%3Cstop offset='60%25' stop-color='%23d4944a' stop-opacity='0.06'/%3E%3Cstop offset='100%25' stop-color='%23d4944a' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='glow2'%3E%3Cstop offset='0%25' stop-color='%23e8b86d' stop-opacity='0.14'/%3E%3Cstop offset='50%25' stop-color='%23e8b86d' stop-opacity='0.05'/%3E%3Cstop offset='100%25' stop-color='%23e8b86d' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='90' cy='90' r='55' fill='url(%23glow)'/%3E%3Ccircle cx='0' cy='0' r='45' fill='url(%23glow2)'/%3E%3Ccircle cx='180' cy='0' r='45' fill='url(%23glow2)'/%3E%3Ccircle cx='0' cy='180' r='45' fill='url(%23glow2)'/%3E%3Ccircle cx='180' cy='180' r='45' fill='url(%23glow2)'/%3E%3Ccircle cx='150' cy='50' r='30' fill='url(%23glow2)'/%3E%3Ccircle cx='30' cy='140' r='35' fill='url(%23glow2)'/%3E%3Ccircle cx='90' cy='0' r='25' fill='url(%23glow2)' opacity='0.8'/%3E%3C/svg%3E\") repeat"
};
const themePatternSizes = {
    light: '300px 300px',
    dark: '300px 300px',
    starry: '200px 200px',
    sakura: '120px 120px',
    sunny: '180px 180px'
};

function applyThemePattern(theme) {
    const pattern = themePatterns[theme] || themePatterns.light;
    const size = themePatternSizes[theme] || '300px 300px';
    document.body.style.backgroundImage = pattern;
    document.body.style.backgroundSize = size + ', auto';
    document.body.style.backgroundRepeat = 'repeat';
}

function updateThemePicker(theme) {
    const dot = document.getElementById('themePickerDot');
    const name = document.getElementById('themePickerName');
    if (dot) dot.style.background = themeDots[theme] || themeDots.light;
    if (name) name.textContent = themeNames[theme] || '月光森林';
}

// ===== 导航栏身份显示 =====
function renderNavIdentity() {
    const me = Identity.getMe();
    const el = document.getElementById('navIdentity');
    if (!el) return;
    el.innerHTML = `
        ${Identity.getAvatarHTML(me, 32)}
        <span class="nav-identity-name">${escapeHtml(me.name)}</span>
    `;
}

// ===== 消息角标 =====
function updateMsgBadge() {
    const count = Messages.getUnreadCount();
    const badge = document.getElementById('msgBadge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ===== Toast 通知 =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== 情绪反应系统 =====
const Reactions = {
    types: [
        { key: 'touched', emoji: '🥹', label: '感动' },
        { key: 'empathy', emoji: '🤗', label: '心疼' },
        { key: 'resonate', emoji: '💪', label: '共鸣' },
        { key: 'agree', emoji: '👏', label: '赞同' },
        { key: 'think', emoji: '🤔', label: '深思' },
        { key: 'warm', emoji: '☀️', label: '温暖' },
    ],

    toggle(postId, reactionKey) {
        const posts = Posts.getAll();
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        if (!post.reactions) post.reactions = {};

        const userId = Identity.getMe().id;

        // 检查用户之前是否已选了同一个
        const wasSame = post.reactions[reactionKey] && post.reactions[reactionKey].includes(userId);

        // 先移除该用户在所有反应中的记录（每个用户只能选一个）
        Object.keys(post.reactions).forEach(key => {
            post.reactions[key] = post.reactions[key].filter(id => id !== userId);
            if (post.reactions[key].length === 0) delete post.reactions[key];
        });

        // 如果之前选的不是同一个，就添加
        if (!wasSame) {
            if (!post.reactions[reactionKey]) post.reactions[reactionKey] = [];
            post.reactions[reactionKey].push(userId);
        }

        Posts.save(posts);
        // 刷新反应栏
        const updatedPost = Posts.getById(postId);
        const bar = document.getElementById('reactionBar');
        if (bar) {
            bar.querySelector('.reaction-buttons').innerHTML = renderReactionButtons(updatedPost);
            bar.querySelector('.reaction-summary').innerHTML = renderReactionSummary(updatedPost);
        }
    },

    getUserReaction(post) {
        if (!post.reactions) return null;
        const userId = Identity.getMe().id;
        for (const [key, users] of Object.entries(post.reactions)) {
            if (users.includes(userId)) return key;
        }
        return null;
    }
};

function renderReactionButtons(post) {
    const userReaction = Reactions.getUserReaction(post);
    return Reactions.types.map(r => {
        const isActive = userReaction === r.key;
        const count = (post.reactions && post.reactions[r.key]) ? post.reactions[r.key].length : 0;
        const showCount = isActive ? count > 1 : count > 0;
        return `
            <button class="reaction-btn ${isActive ? 'active' : ''}" 
                    onclick="Reactions.toggle('${post.id}', '${r.key}')"
                    title="${r.label}">
                <span class="reaction-emoji">${r.emoji}</span>
                ${showCount ? `<span class="reaction-count">${isActive ? count : count}</span>` : ''}
            </button>
        `;
    }).join('');
}

function renderReactionSummary(post) {
    if (!post.reactions || Object.keys(post.reactions).length === 0) return '';
    const parts = [];
    Reactions.types.forEach(r => {
        const users = post.reactions[r.key];
        if (users && users.length > 0) {
            parts.push(`${r.emoji} ${users.length}`);
        }
    });
    return parts.length > 0 ? `<span class="reaction-text">${parts.join('　')}</span>` : '';
}

// ===== HTML 转义 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 身份设置模态框 =====
let settingsTemp = { emoji: null, style: 'emoji', nickname: '', color: null, gradient: null };

function openSettingsModal() {
    const me = Identity.getMe();
    // 初始化临时状态
    settingsTemp = {
        emoji: me.emoji || null,
        style: me.style || 'emoji',
        nickname: me.name,
        color: me.color,
        gradient: me.gradient || Identity.gradients[0]
    };

    // 填充 Emoji 网格
    const emojiGrid = document.getElementById('emojiGrid');
    emojiGrid.innerHTML = '';
    Identity.emojiOptions.forEach((e, i) => {
        const div = document.createElement('div');
        div.className = 'emoji-item' + (settingsTemp.emoji === e ? ' selected' : '');
        div.textContent = e;
        div.dataset.index = i;
        div.addEventListener('click', function() {
            selectEmoji(this, Identity.emojiOptions[this.dataset.index]);
        });
        emojiGrid.appendChild(div);
    });

    // 填充颜色网格
    const colorGrid = document.getElementById('colorGrid');
    colorGrid.innerHTML = Identity.colors.map(c => `
        <div class="color-item ${settingsTemp.color === c ? 'selected' : ''}" 
             data-color="${c}" style="background:${c}" onclick="selectColor(this, '${c}')"></div>
    `).join('');

    // 设置头像风格
    const styleRadio = document.querySelector(`#styleSelect input[value="${settingsTemp.style}"]`);
    if (styleRadio) styleRadio.checked = true;

    // 初始化 Emoji 选择区显示状态
    const emojiSection = document.getElementById('emojiSection');
    if (emojiSection) {
        emojiSection.style.display = settingsTemp.style === 'emoji' ? '' : 'none';
    }

    // 填充昵称输入
    document.getElementById('nicknameInput').value = me.name;

    // 设置 MBTI 选择器
    const mbtiSel = document.getElementById('mbtiSelect');
    if (mbtiSel) mbtiSel.value = me.mbti || '';

    // 初始化角色 radio 选中状态
    const roleRadio = document.querySelector(`input[name="settingsRole"][value="${Roles.getRole()}"]`);
    if(roleRadio) roleRadio.checked = true;

    // 更新预览
    updateSettingsPreview();

    // 叶脉号展示
    const veinId = RemoteUser.getVeinId();
    const veinSection = document.getElementById('veinIdSection');
    if (veinSection) {
        if (veinId) {
            veinSection.style.display = '';
            document.getElementById('veinIdDisplay').textContent = veinId;
        } else {
            veinSection.style.display = 'none';
        }
    }

    document.getElementById('settingsModal').style.display = 'flex';
}

function copyVeinId() {
    const veinId = RemoteUser.getVeinId();
    if (!veinId) return;
    navigator.clipboard.writeText(veinId).then(() => {
        showToast('叶脉号已复制');
    }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = veinId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('叶脉号已复制');
    });
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function selectEmoji(el, emoji) {
    document.querySelectorAll('.emoji-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    settingsTemp.emoji = emoji;
    updateSettingsPreview();
}

function selectColor(el, color) {
    document.querySelectorAll('.color-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    settingsTemp.color = color;
    updateSettingsPreview();
}

function randomizeNickname() {
    const adj = Identity.adjectives[Math.floor(Math.random() * Identity.adjectives.length)];
    const noun = Identity.nouns[Math.floor(Math.random() * Identity.nouns.length)];
    document.getElementById('nicknameInput').value = adj + noun;
    settingsTemp.nickname = adj + noun;
    updateSettingsPreview();
}

function updateSettingsPreview() {
    const preview = document.getElementById('settingsPreview');
    const me = Identity.getMe();
    const displayName = settingsTemp.nickname || me.name;

    // 构建临时身份用于预览
    const tempIdentity = {
        name: displayName,
        color: settingsTemp.color,
        emoji: settingsTemp.emoji,
        style: settingsTemp.style,
        gradient: settingsTemp.gradient
    };

    const avatarHTML = Identity.getAvatarHTML(tempIdentity, 64);
    preview.innerHTML = `
        <div class="settings-preview-inner">
            ${avatarHTML}
            <div class="preview-name">${escapeHtml(displayName)}</div>
            <div class="preview-role">这就是其他用户看到的你</div>
        </div>
    `;
}

function saveSettings() {
    const me = Identity.getMe();
    const nickname = document.getElementById('nicknameInput').value.trim();

    // 更新身份
    if (nickname) me.name = nickname;
    me.mbti = document.getElementById('mbtiSelect').value || null;
    me.emoji = settingsTemp.emoji;
    me.style = settingsTemp.style;
    me.color = settingsTemp.color;
    me.gradient = settingsTemp.gradient;

    DB.set('my_identity', me);
    const roleEl = document.querySelector('input[name="settingsRole"]:checked');
    if(roleEl) Roles.setRole(roleEl.value);

    // 读取"允许被查找"开关状态
    const allowFindEl = document.getElementById('allowFindToggle');
    const allowFind = allowFindEl ? allowFindEl.checked : true;

    // 同步到远程
    (async () => {
        await RemoteUser.updateUser({
            nickname: me.name,
            role: Roles.getRole(),
            mbti: me.mbti,
            avatar_style: me.style,
            avatar_emoji: me.emoji,
            avatar_color: me.color,
            allow_find: allowFind ? 1 : 0
        });
    })();

    closeSettingsModal();
    showToast('身份设置已保存');

    // 刷新导航栏头像和当前页面
    renderNavIdentity();
    navigate(currentPage);
}

// 监听昵称输入实时更新预览
document.addEventListener('DOMContentLoaded', () => {
    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput) {
        nicknameInput.addEventListener('input', () => {
            settingsTemp.nickname = nicknameInput.value.trim();
            updateSettingsPreview();
        });
    }

    // 监听头像风格切换
    document.querySelectorAll('#styleSelect input[name="avatarStyle"]').forEach(radio => {
        radio.addEventListener('change', () => {
            settingsTemp.style = radio.value;
            const emojiSection = document.getElementById('emojiSection');
            if (emojiSection) {
                emojiSection.style.display = radio.value === 'emoji' ? '' : 'none';
            }
            updateSettingsPreview();
        });
    });
});

// ===== 树洞回信 =====
const Letter = {
    getAll() {
        return DB.get('letters') || [];
    },
    save(letters) {
        DB.set('letters', letters);
    },
    create(data) {
        const letters = this.getAll();
        const openAt = data.openAt || (Date.now() + (data.openDays || 7) * 24 * 60 * 60 * 1000);
        const letter = {
            id: 'letter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            content: data.content,
            writtenAt: Date.now(),
            writtenDate: new Date().toISOString().split('T')[0],
            openDays: data.openDays || Math.ceil((openAt - Date.now()) / (24 * 60 * 60 * 1000)),
            openAt: openAt,
            opened: false,
            to_user_id: data.to_user_id || null, // 跨用户信件
            from_user_id: data.from_user_id || null
        };
        letters.unshift(letter);
        this.save(letters);

        // 尝试同步到远程
        (async () => {
            const userId = RemoteUser.getUserId();
            if (userId) {
                await api('POST', '/api/letters', {
                    from_id: userId,
                    to_id: data.to_user_id || userId,
                    content: data.content,
                    open_at: new Date(openAt).toISOString()
                });
            }
        })();

        return letter;
    },
    open(id) {
        const letters = this.getAll();
        const idx = letters.findIndex(l => l.id === id);
        if (idx !== -1) {
            letters[idx].opened = true;
            letters[idx].openedAt = Date.now();
            this.save(letters);
        }

        // 尝试远程开封
        (async () => {
            await api('PUT', '/api/letters/' + id + '/open');
        })();
    },
    delete(id) {
        const letters = this.getAll().filter(l => l.id !== id);
        this.save(letters);
    },
    isReady(letter) {
        return Date.now() >= letter.openAt;
    },

    // 从远程获取收件箱
    async fetchInbox() {
        const userId = RemoteUser.getUserId();
        if (!userId) return null;
        return await api('GET', '/api/letters/inbox?user_id=' + userId);
    },

    // 从远程获取已发送
    async fetchSent() {
        const userId = RemoteUser.getUserId();
        if (!userId) return null;
        return await api('GET', '/api/letters/sent?user_id=' + userId);
    }
};

let selectedLetterDays = 3;
let selectedLetterCustomTime = null;
let letterTab = 'all'; // 'all', 'inbox', 'sent'

function formatDateTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderLetterPage() {
    renderLetterList();
}

function switchLetterTab(tab) {
    letterTab = tab;
    document.querySelectorAll('.letter-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderLetterList();
}

async function renderLetterList() {
    const list = document.getElementById('letterList');
    if (!list) return;

    // 渲染 tab 按钮
    const tabHtml = `
        <div class="letter-tabs">
            <button class="letter-tab-btn ${letterTab === 'all' ? 'active' : ''}" data-tab="all" onclick="switchLetterTab('all')">全部</button>
            <button class="letter-tab-btn ${letterTab === 'inbox' ? 'active' : ''}" data-tab="inbox" onclick="switchLetterTab('inbox')">收件箱</button>
            <button class="letter-tab-btn ${letterTab === 'sent' ? 'active' : ''}" data-tab="sent" onclick="switchLetterTab('sent')">已发送</button>
        </div>
    `;

    let letters = Letter.getAll();

    // 如果是收件箱或已发送 tab，尝试从远程拉取
    if (letterTab === 'inbox') {
        const remoteInbox = await Letter.fetchInbox();
        if (remoteInbox && Array.isArray(remoteInbox) && remoteInbox.length > 0) {
            // 合并远程信件（去重）
            const localIds = new Set(letters.map(l => l.id));
            remoteInbox.forEach(rl => {
                if (!localIds.has(rl.id)) {
                    letters.push({
                        id: rl.id,
                        content: rl.content,
                        writtenAt: new Date(rl.created_at || rl.writtenAt).getTime(),
                        writtenDate: (rl.created_at || rl.writtenAt || '').split('T')[0],
                        openDays: rl.open_days || 7,
                        openAt: new Date(rl.open_at || rl.openAt).getTime(),
                        opened: !!rl.opened,
                        from_user_id: rl.from_id || null,
                        to_user_id: rl.to_id || null
                    });
                }
            });
            Letter.save(letters);
        }
        letters = letters.filter(l => l.to_user_id && l.to_user_id !== RemoteUser.getUserId());
    } else if (letterTab === 'sent') {
        const remoteSent = await Letter.fetchSent();
        if (remoteSent && Array.isArray(remoteSent) && remoteSent.length > 0) {
            const localIds = new Set(letters.map(l => l.id));
            remoteSent.forEach(rl => {
                if (!localIds.has(rl.id)) {
                    letters.push({
                        id: rl.id,
                        content: rl.content,
                        writtenAt: new Date(rl.created_at || rl.writtenAt).getTime(),
                        writtenDate: (rl.created_at || rl.writtenAt || '').split('T')[0],
                        openDays: rl.open_days || 7,
                        openAt: new Date(rl.open_at || rl.openAt).getTime(),
                        opened: !!rl.opened,
                        from_user_id: rl.from_id || null,
                        to_user_id: rl.to_id || null
                    });
                }
            });
            Letter.save(letters);
        }
        letters = letters.filter(l => l.from_user_id && l.from_user_id === RemoteUser.getUserId() && l.to_user_id && l.to_user_id !== RemoteUser.getUserId());
    }

    if (letters.length === 0) {
        list.innerHTML = tabHtml + `
            <div class="letter-empty">
                <div class="letter-empty-icon">📬</div>
                <p>${letterTab === 'inbox' ? '收件箱为空' : letterTab === 'sent' ? '还没有发送信件' : '还没有回信'}</p>
                <p style="font-size:13px;margin-top:4px">${letterTab === 'all' ? '写一封信给未来的自己吧' : letterTab === 'inbox' ? '等待别人给你写信' : '给朋友写一封信吧'}</p>
            </div>
        `;
        return;
    }

    list.innerHTML = tabHtml + letters.map(l => {
        const isReady = Letter.isReady(l);
        const isOpened = l.opened;
        const openDate = new Date(l.openAt).toISOString().split('T')[0];
        
        if (!isReady && !isOpened) {
            // 封印中
            const daysLeft = Math.max(0, Math.ceil((l.openAt - Date.now()) / (24 * 60 * 60 * 1000)));
            const title = l.content.length > 20 ? l.content.slice(0, 20) + '...' : l.content;
            return `
                <div class="letter-item sealed">
                    <div class="letter-sealed-bg">
                        <div class="letter-sealed-info">
                            <span class="letter-sealed-written">${l.writtenDate}</span>
                            <span class="letter-sealed-countdown">🔒 封印中 · 还有 ${daysLeft} 天</span>
                        </div>
                        <div class="letter-sealed-title">${escapeHtml(title)}</div>
                        <div class="letter-sealed-open-date">${formatDateTime(l.openAt)} 可开封</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="letter-item" onclick="viewLetter('${l.id}')">
                <div class="letter-item-header">
                    <span class="letter-item-date">${l.writtenDate}</span>
                    <span class="letter-item-status ${isOpened ? 'opened' : 'pending'}">${isOpened ? '已读' : '可开封'}</span>
                </div>
                <div class="letter-item-preview">${escapeHtml(l.content)}</div>
            </div>
        `;
    }).join('');
}

function openLetterEditor() {
    selectedLetterDays = 3;
    selectedLetterCustomTime = null;
    document.getElementById('letterContent').value = '';
    document.getElementById('letterCustomTime').value = '';
    const recipientInput = document.getElementById('letterRecipientVeinId');
    if (recipientInput) recipientInput.value = '';
    document.querySelectorAll('.letter-time-options .diary-mood-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.days === '3');
    });
    document.getElementById('letterEditorModal').style.display = 'flex';
}

function closeLetterEditor() {
    document.getElementById('letterEditorModal').style.display = 'none';
}

function selectLetterTime(days, el) {
    selectedLetterDays = days;
    selectedLetterCustomTime = null;
    document.getElementById('letterCustomTime').value = '';
    document.querySelectorAll('.letter-time-options .diary-mood-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

function selectCustomLetterTime(input) {
    if (input.value) {
        const selectedTime = new Date(input.value).getTime();
        if (selectedTime <= Date.now()) {
            showToast('请选择未来的时间');
            input.value = '';
            selectedLetterCustomTime = null;
            return;
        }
        selectedLetterCustomTime = selectedTime;
        // 取消预设按钮的选中状态
        document.querySelectorAll('.letter-time-options .diary-mood-btn').forEach(b => b.classList.remove('active'));
    } else {
        selectedLetterCustomTime = null;
    }
}

function saveLetter() {
    const content = document.getElementById('letterContent').value.trim();
    if (!content) { showToast('写点什么给未来的自己吧'); return; }

    const openAt = selectedLetterCustomTime || (Date.now() + selectedLetterDays * 24 * 60 * 60 * 1000);
    if (openAt <= Date.now()) {
        showToast('请选择未来的时间');
        return;
    }

    // 检查是否有收件人叶脉号
    const recipientVeinId = document.getElementById('letterRecipientVeinId');
    let toUserId = null;
    if (recipientVeinId && recipientVeinId.value.trim()) {
        const veinId = recipientVeinId.value.trim().toUpperCase();
        if (!/^[A-Z0-9]{7}$/.test(veinId)) {
            showToast('叶脉号格式不正确，应为7位大写字母和数字');
            return;
        }
        // 查找用户获取 userId
        const user = await RemoteUser.findByVeinId(veinId);
        if (!user) {
            showToast('未找到该叶脉号对应的用户');
            return;
        }
        toUserId = user.userId;
    }

    Letter.create({ content, openAt, to_user_id: toUserId });
    closeLetterEditor();
    renderLetterList();
    showToast(toUserId ? '信已发送给对方' : '信已埋进树洞，等待回信...');
}

function viewLetter(id) {
    const letter = Letter.getAll().find(l => l.id === id);
    if (!letter) return;
    
    const isReady = Letter.isReady(letter);
    
    if (!isReady && !letter.opened) return;
    
    if (!letter.opened) {
        Letter.open(id);
    }
    
    const openDate = new Date(letter.openAt).toISOString().split('T')[0];
    
    document.getElementById('letterViewBody').innerHTML = `
        <div class="letter-opening">
            <div class="letter-opening-icon">📬</div>
            <div class="letter-opening-text">来自 ${letter.writtenDate} 的你，写给现在的你</div>
        </div>
        <div class="letter-view-text">${escapeHtml(letter.content)}</div>
        <div class="letter-view-meta">
            <span>写于 ${letter.writtenDate} · 封存 ${letter.openDays} 天</span>
            <button class="btn-ghost btn-sm" onclick="deleteLetter('${letter.id}');closeLetterView()">删除</button>
        </div>
    `;
    document.getElementById('letterViewModal').style.display = 'flex';
}

function closeLetterView() {
    document.getElementById('letterViewModal').style.display = 'none';
}

function deleteLetter(id) {
    Letter.delete(id);
    renderLetterList();
}

// ===== 初始化 =====
function init() {
    Identity.init();

    // 加载主题
    const savedTheme = DB.get('theme', 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemePicker(savedTheme);
    applyThemePattern(savedTheme);

    // 首次使用：显示角色选择
    if (!Roles.getRole()) {
        document.getElementById('roleModal').style.display = 'flex';
    }

    // 自动注册到远程服务器
    RemoteUser.ensureRegistered().then(success => {
        if (success) {
            console.log('[RemoteUser] 已注册，叶脉号:', RemoteUser.getVeinId());
        }
    });

    // 生成示例数据（首次使用）
    if (Posts.getAll().length === 0) {
        generateSampleData();
    }

    // 兼容旧数据：为没有 channel/mood 的帖子补充默认值
    migrateOldData();

    navigate('home');
    updateMsgBadge();
    renderNavIdentity();
    initHero();
    initMbtiSelects();
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
            navigate(e.state.page, e.state.data || {}, false);
        } else {
            navigate('home', {}, false);
        }
    });

    // Escape 关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const modals = [
            { id: 'roleModal', close: () => { document.getElementById('roleModal').style.display = 'none'; } },
            { id: 'settingsModal', close: closeSettingsModal },
            { id: 'themeModal', close: closeThemeModal },
            { id: 'mbtiTestModal', close: closeMbtiTest },
            { id: 'dmModal', close: () => { closeDmModal(); } },
            { id: 'reportModal', close: () => { closeReportModal(); } },
            { id: 'discoverModal', close: closeDiscoverModal },
            { id: 'aboutModal', close: closeAboutModal },
            { id: 'diaryEditorModal', close: closeDiaryEditor },
            { id: 'diaryViewModal', close: closeDiaryView },
            { id: 'letterEditorModal', close: () => { document.getElementById('letterEditorModal').style.display = 'none'; } },
            { id: 'letterViewModal', close: () => { document.getElementById('letterViewModal').style.display = 'none'; } },
        ];
        for (const modal of modals) {
            const el = document.getElementById(modal.id);
            if (el && el.style.display === 'flex') {
                modal.close();
                break;
            }
        }
    });
}

// ===== 兼容旧数据 =====
function migrateOldData() {
    const posts = Posts.getAll();
    let needsSave = false;
    posts.forEach(post => {
        if (!post.channel) { post.channel = '树洞'; needsSave = true; }
        if (!post.mood) { post.mood = null; needsSave = true; }
        if (!post.reports) { post.reports = []; needsSave = true; }
        if (!post.auditStatus) { post.auditStatus = 'approved'; needsSave = true; }
    });
    if (needsSave) Posts.save(posts);
}

// ===== 生成示例数据 =====
function generateSampleData() {
    const roleKeys = Object.keys(Roles.map);
    const sampleIdentities = [
        { name: '温柔的猫咪', color: '#e07c5a', id: 'sample_1', role: roleKeys[Math.floor(Math.random() * roleKeys.length)] },
        { name: '自由的旅人', color: '#5b8cc9', id: 'sample_2', role: roleKeys[Math.floor(Math.random() * roleKeys.length)] },
        { name: '安静的星辰', color: '#9b6bb0', id: 'sample_3', role: roleKeys[Math.floor(Math.random() * roleKeys.length)] },
        { name: '浪漫的月光', color: '#c9a84c', id: 'sample_4', role: roleKeys[Math.floor(Math.random() * roleKeys.length)] },
        { name: '勇敢的海鸥', color: '#4a9e7d', id: 'sample_5', role: roleKeys[Math.floor(Math.random() * roleKeys.length)] },
    ];

    const samplePosts = [
        {
            author: sampleIdentities[0],
            title: '今天在公园看到一只超可爱的柴犬',
            content: '下班回家的路上经过公园，看到一只柴犬在草地上打滚，毛茸茸的特别治愈。主人说它叫"团子"，三岁了。忍不住蹲下来摸了好久，感觉一天的疲惫都消失了。\n\n有时候觉得，生活中这些小小的美好瞬间，才是最值得珍惜的。',
            tags: ['日常'],
            channel: '生活',
            mood: '开心',
            createdAt: Date.now() - 3600000 * 2,
            likes: ['sample_2', 'sample_3', 'sample_4'],
            comments: [
                { id: 'sc1', author: sampleIdentities[1], text: '柴犬真的太治愈了！我也好想养一只', createdAt: Date.now() - 3600000 },
                { id: 'sc2', author: sampleIdentities[2], text: '同意，小确幸才是生活的本质', createdAt: Date.now() - 1800000 }
            ]
        },
        {
            author: sampleIdentities[1],
            title: '分享一个提高效率的方法：番茄工作法',
            content: '最近尝试了番茄工作法，效果真的很好！具体做法是：\n\n1. 选择一个任务\n2. 设定25分钟计时器\n3. 专注工作，不做其他事\n4. 计时器响后休息5分钟\n5. 每完成4个番茄钟，休息15-30分钟\n\n坚持了一周，感觉工作效率提升了不少，注意力也更集中了。推荐给经常拖延的朋友试试！',
            tags: ['经验', '分享'],
            channel: '职场',
            mood: '期待',
            createdAt: Date.now() - 3600000 * 8,
            likes: ['sample_3', 'sample_4', 'sample_5', 'sample_0'],
            comments: [
                { id: 'sc3', author: sampleIdentities[3], text: '这个方法我也在用，配合 Forest App 效果更好', createdAt: Date.now() - 3600000 * 5 },
                { id: 'sc4', author: sampleIdentities[4], text: '谢谢分享！正好需要这种方法', createdAt: Date.now() - 3600000 * 3 }
            ]
        },
        {
            author: sampleIdentities[2],
            title: '深夜的心事：30岁了还在迷茫',
            content: '今天过了30岁生日，朋友们都发来祝福，但我心里却很复杂。\n\n看着同龄人有的已经结婚生子，有的事业有成，而我好像还在原地踏步。工作不算差，但也说不上热爱；感情方面更是一片空白。\n\n有时候会想，是不是自己太贪心了？但内心深处总觉得，人生应该有更多的可能性。\n\n不知道有没有和我一样的人...',
            tags: ['心事'],
            channel: '树洞',
            mood: '迷茫',
            createdAt: Date.now() - 3600000 * 24,
            likes: ['sample_0', 'sample_1', 'sample_3', 'sample_4', 'sample_5'],
            comments: [
                { id: 'sc5', author: sampleIdentities[0], text: '抱抱你，30岁只是开始，不是终点。每个人都有自己的节奏。', createdAt: Date.now() - 3600000 * 20 },
                { id: 'sc6', author: sampleIdentities[4], text: '我35了也还在迷茫，但慢慢发现迷茫本身也是一种探索', createdAt: Date.now() - 3600000 * 18 },
                { id: 'sc7', author: sampleIdentities[1], text: '迷茫说明你在思考，这比浑浑噩噩好多了', createdAt: Date.now() - 3600000 * 15 }
            ]
        },
        {
            author: sampleIdentities[3],
            title: '吐槽：为什么外卖越来越难吃了',
            content: '最近点了好几次外卖，感觉质量越来越差了。要么是分量少得可怜，要么是味道完全不对。\n\n昨天点了一份红烧排骨，打开一看全是骨头没有肉。找客服理论，对方就只会说"抱歉给您带来不好的体验"。\n\n大家有没有推荐的靠谱外卖店铺？或者有什么好的解决方法？',
            tags: ['吐槽', '求助'],
            channel: '生活',
            mood: '愤怒',
            createdAt: Date.now() - 3600000 * 12,
            likes: ['sample_0', 'sample_2'],
            comments: [
                { id: 'sc8', author: sampleIdentities[2], text: '建议自己做饭，既健康又省钱', createdAt: Date.now() - 3600000 * 10 }
            ]
        },
        {
            author: sampleIdentities[4],
            title: '推荐几本最近读过的好书',
            content: '最近读了几本很不错的书，分享给大家：\n\n📖《被讨厌的勇气》- 阿德勒心理学入门，改变了我对人际关系的看法\n📖《原子习惯》- 关于习惯养成的实用指南\n📖《当下的力量》- 帮助减轻焦虑，活在当下\n📖《人类简史》- 从宏观角度理解人类文明\n\n每本都值得反复阅读，有兴趣的朋友可以看看！',
            tags: ['分享', '经验'],
            channel: '树洞',
            mood: '平静',
            createdAt: Date.now() - 3600000 * 36,
            likes: ['sample_0', 'sample_1', 'sample_2', 'sample_3'],
            comments: [
                { id: 'sc9', author: sampleIdentities[0], text: '《被讨厌的勇气》真的很好！', createdAt: Date.now() - 3600000 * 30 },
                { id: 'sc10', author: sampleIdentities[1], text: '《原子习惯》已经在读清单里了，谢谢推荐', createdAt: Date.now() - 3600000 * 28 }
            ]
        },
        {
            author: sampleIdentities[0],
            title: '考研倒计时30天，好焦虑',
            content: '距离考研只剩30天了，政治还没背完，英语作文模板也没整理好。每天学到凌晨两点，早上六点又爬起来。\n\n室友们都已经找到工作了，只有我还在死磕考研。有时候真的会怀疑自己的选择是不是对的...\n\n但想想自己为什么出发，还是咬牙坚持吧。加油！',
            tags: ['心事', '日常'],
            channel: '校园',
            mood: '焦虑',
            createdAt: Date.now() - 3600000 * 5,
            likes: ['sample_1', 'sample_2', 'sample_3', 'sample_4'],
            comments: [
                { id: 'sc11', author: sampleIdentities[1], text: '加油！最后30天效率最高的就是现在', createdAt: Date.now() - 3600000 * 4 },
                { id: 'sc12', author: sampleIdentities[4], text: '当年我也这样过来的，回头看一切都是值得的', createdAt: Date.now() - 3600000 * 2 }
            ]
        },
        {
            author: sampleIdentities[3],
            title: '暗恋了三年的同事今天离职了',
            content: '她在公司坐我隔壁工位三年了。每天早上她会带一杯拿铁，偶尔会分我一块饼干。\n\n我们聊过很多，从电影到音乐到人生理想。但我始终没有勇气说出那句话。\n\n今天是她最后一天，我帮她搬了箱子，说了"祝你一切顺利"。她笑着说"谢谢你，以后常联系"。\n\n也许有些话，不说也是一种美好吧。',
            tags: ['心事'],
            channel: '情感',
            mood: '难过',
            createdAt: Date.now() - 3600000 * 48,
            likes: ['sample_0', 'sample_1', 'sample_2', 'sample_4', 'sample_5'],
            comments: [
                { id: 'sc13', author: sampleIdentities[0], text: '好遗憾...但你说得对，有些美好留在记忆里就好', createdAt: Date.now() - 3600000 * 40 },
                { id: 'sc14', author: sampleIdentities[2], text: '"以后常联系"——也许她也在等你主动呢', createdAt: Date.now() - 3600000 * 38 }
            ]
        }
    ];

    samplePosts.forEach((post, i) => {
        post.id = 'sample_p_' + i;
        post.image = null;
        post.reports = [];
        post.auditStatus = 'approved';
    });

    Posts.save(samplePosts);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
