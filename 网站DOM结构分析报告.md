# 5个新闻网站 DOM 结构分析报告

## 1. 财新网桌面版 (database.caixin.com)

**URL**: https://database.caixin.com/2026-04-21/102436353.html

### 核心内容容器

| 元素 | CSS 选择器 | 说明 |
|------|-----------|------|
| 标题 | `h1` | 文章标题，无额外 class |
| 正文容器 | `#the_content` (即 `div.article`) | 包含标题、作者信息、正文段落、图片说明 |
| 正文主体区域 | `.comMain > .conlf` | 左侧主内容列，包含面包屑+标题+正文 |
| 右侧栏 | `.comMain > .conri` | "编辑推荐"侧边栏（非核心） |

### 需要隐藏的非核心元素

| 类别 | CSS 选择器 | 说明 |
|------|-----------|------|
| 导航栏/头部 | `.head` | 包含登录/注册、频道导航 |
| 顶部导航 | `.sitenav` | 商城、订阅、登录、注册链接 |
| 主导航 | `.mainnav` | 首页、经济、金融、公司等频道导航 |
| 面包屑 | `.crumb` | "财新数据通 > 专享资讯 > 特报 > 正文" |
| 广告 | `.topAd` | 顶部广告位 |
| 相关推荐 | `.pip` | "相关报道"推荐文章列表 |
| 评论区 | `#comment` | 评论区及评论列表 `.comment-list` |
| 页脚 | `.bottom` | 版权信息、备案号 |
| 分享工具 | `.share_tool` | 社交分享按钮 |
| AI注入内容 | `.aitt` | 第三方AI总结注入（非原始内容） |
| iframe | `#sina_anywhere_iframe` | 新浪微博相关 iframe |
| SEO隐藏内容 | `#relate_subject_seo` | SEO用途的隐藏相关主题 |
| 右侧栏 | `.comMain > .conri` | 编辑推荐侧边栏 |
| 选字菜单 | `.select-text-menu` | 文字选择弹出菜单 |

---

## 2. 财新网移动版 (companies.caixin.com/m/)

**URL**: http://companies.caixin.com/m/2026-04-22/102436804.html

### 核心内容容器

| 元素 | CSS 选择器 | 说明 |
|------|-----------|------|
| 标题 | `h1.news-title` | 文章标题 |
| 正文容器 | `#cons` (即 `div.cons`) | 包含频道标签、标题、作者、日期、正文 |
| 正文段落 | `#cons .article-content` 或 `#cons p` | 文章正文段落 |

### 需要隐藏的非核心元素

| 类别 | CSS 选择器 | 说明 |
|------|-----------|------|
| 头部导航 | `header` | 顶部 header 元素 |
| 菜单遮罩 | `.menu-mask` | 侧边菜单遮罩层 |
| 菜单面板 | `.menu-box` | 侧边导航菜单 |
| 登录遮罩 | `.login-mask` | 登录弹窗遮罩 |
| 登录面板 | `.login-box` | 登录弹窗 |
| 搜索遮罩 | `.search-mask` | 搜索弹窗遮罩 |
| 搜索面板 | `.search-box` | 搜索弹窗 |
| 广告 | `[class*="ad-media"]` (2个) | 文章内广告位 |
| 广告 | `#pay-layer-ad`, `#pay-layer-pro-ad`, `#pay-layer-in-ad` | 付费墙相关广告 |
| 付费墙 | `#chargeWall` | "订阅后继续阅读"付费提示 |
| APP下载横幅 | `.top-box` | 顶部APP下载横幅 |
| APP下载链接 | `.appLink` | APP下载链接 |
| 在APP中打开 | `.openInApp` | "在APP中打开"提示 |
| 评论区 | `#topboxcomment` | 评论区 |
| 弹窗 | `.cpl_popup` | 弹窗遮罩 |
| 推荐信息 | `#article_end_wrapper` (`.article_end`) | 底部推荐信息 |
| 英文版链接 | `.other-con` | 英文版报道链接 |
| APP推荐 | `section.caixin-app` | 财新APP下载推荐 |
| 页脚 | `footer.foot` | 登录、网页版、版权信息 |
| 返回顶部 | `.go-top` | 返回顶部按钮 |
| 添加到主屏幕 | `.addBox` | "添加到主屏幕"提示 |
| 责任编辑 | `.zan_box02` | 责任编辑、版面编辑信息 |
| 话题标签 | `.article_topic` | 文章话题标签 |
| 广告占位 | `.news-ad` | 新闻广告位 |

---

## 3. 工信部 (miit.gov.cn)

**URL**: https://www.miit.gov.cn/xwfb/bldhd/art/2026/art_5df37c8c6c99464694873048cc180a92.html

### 核心内容容器

| 元素 | CSS 选择器 | 说明 |
|------|-----------|------|
| 标题 | `#con_title` | 文章标题（h1） |
| 标题区域 | `.ctitle` | 标题容器 |
| 发布信息 | `.cinfo.center` | "发布时间、来源"等信息 |
| 正文 | `#con_con` (即 `div.ccontent.center`) | 文章正文内容 |
| 整体内容区 | `.w980.center.cmain` | 包含标题+信息+正文+相关文章的完整内容区 |

### 需要隐藏的非核心元素

| 类别 | CSS 选择器 | 说明 |
|------|-----------|------|
| 头部 | `.head.w1100` | Logo、阳光小信、无障碍、手机端、邮箱等 |
| 主导航 | `.nav` | 首页、组织机构、新闻发布、政务公开等 |
| 面包屑 | `.mnav` (即 `.w980.center.mnav`) | "首页 > 新闻发布 > 部领导活动" |
| 页脚 | `.bottom` | 中国政府网链接、版权信息 |
| 移动端页脚 | `.mob-bottom` | 移动端底部导航 |
| 相关文章 | `.related` | "相关文章"推荐列表 |
| 相关文章(动态) | `[id^="authorizedRead_"]` | 动态加载的相关文章 |
| 分享按钮 | `.share` (2个) | 分享到微信等功能 |
| 二维码 | `#ewmzs` | "扫一扫在手机打开当前页"二维码 |
| 文章工具栏 | `.article_fd` | 分享、返回顶部、关闭窗口、打印等工具 |
| 无障碍提示 | `#ariaTipText` | 无障碍访问提示链接 |

---

## 4. 新华网 (xinhuanet.com)

**URL**: http://www.xinhuanet.com/liangzi/20260422/1f6cf7e9d2314d40bd55310132793591/c.html

### 核心内容容器

| 元素 | CSS 选择器 | 说明 |
|------|-----------|------|
| 标题(PC) | `.head-line h1` | PC端文章标题 |
| 标题(移动) | `.mheader h1` | 移动端文章标题 |
| 正文(PC) | `div.main > .main-left` | PC端左侧正文区域 |
| 正文(移动) | `div.main` | 整个 main 区域（移动端无左右分栏） |
| 正文段落 | `div.main p` | 正文段落 |

### 需要隐藏的非核心元素

| 类别 | CSS 选择器 | 说明 |
|------|-----------|------|
| PC头部 | `.header.domPC` | Logo、面包屑导航、日期、来源、标题、字体设置、分享 |
| 移动端头部 | `.mheader.domMobile` | 移动端头部 |
| 移动端顶部 | `.mob-top.domMob` | 移动端顶部区域 |
| 导航栏 | `.nav` | 学习进行时、高层时政、国际、财经等频道导航 |
| 顶部广告 | `.topAd` | 顶部广告位 |
| 广告区域 | `.adv` (2个) | PC端和移动端广告区域 |
| 广告表单 | `[id^="YCADS_FORM"]` (12个) | 广告追踪隐藏表单 |
| 右侧栏 | `.main-right.right` | "深度观察"等推荐内容侧边栏 |
| 相关新闻 | `.relatedNews` | 相关新闻推荐 |
| 分享按钮 | `.share` | "分享到："分享功能 |
| 来源信息 | `.source` | "来源：科技日报" |
| 编辑信息 | `.editor` | "责任编辑"信息 |
| 搜索框 | `.search` | 站内搜索 |
| 二维码浮层 | `.fix-ewm` | 固定定位的二维码浮层 |
| 页脚 | `.foot` | 页脚 |
| 底部链接 | `.lib-foot` | 底部版权链接区 |
| 无障碍提示 | `#ariaTipText` | 无障碍访问提示 |

---

## 5. 澎湃新闻移动版 (m.thepaper.cn)

**URL**: https://m.thepaper.cn/newsDetail_forward_32996101

### 核心内容容器

| 元素 | CSS 选择器 | 说明 |
|------|-----------|------|
| 标题 | `h1.title__FIwxD` | 文章标题（注意：class名含CSS Modules哈希） |
| 正文容器 | `.wrapbox__jn3fz` | 文章整体内容区（标题+作者+正文） |
| 正文主体 | `.wrapper__U7hc_` | 包含频道标签、标题、作者信息、正文段落 |
| 整体应用容器 | `#__next` | Next.js 应用根容器 |

> **注意**: 澎湃新闻使用 CSS Modules，class 名中包含哈希值（如 `__FIwxD`、`__jn3fz`、`__U7hc_`），这些哈希值可能会在每次部署时变化。建议使用更稳定的选择器策略。

### 需要隐藏的非核心元素

| 类别 | CSS 选择器 | 说明 |
|------|-----------|------|
| 头部导航 | `#wap_header` | Logo、下载APP按钮、菜单 |
| 下载APP按钮 | `[data-statclick="downloadApp"]` | "下载APP"链接 |
| 频道标签 | `.top_ad_articleNo__RnhKF` | "澎湃号·媒体 >"频道标签 |
| APP下载横幅 | `.footer_banner__H0dAr` | 底部"你有权知道更多"APP下载横幅 |
| 横幅关闭按钮 | `.footer_banner_close__r35q4` | 横幅关闭按钮 |
| 横幅面板 | `.footer_banner_panel__QE2fg` | 横幅内容面板 |
| 页脚 | `#footer` (即 `footer.footer__zOzQH`) | 关于澎湃、联系我们、法律声明、版权信息 |
| 广告测试 | `.adm-px-tester` | 广告像素测试元素 |

---

## 汇总：通用隐藏规则建议

以下是适用于大多数新闻网站的通用 CSS 隐藏规则：

```css
/* === 通用隐藏规则 === */

/* 导航栏 */
header, .header, .head, nav, .nav, .mainnav, .sitenav, .top-nav, .navigation

/* 面包屑 */
.breadcrumb, .breadcrumbs, .crumb, .mnav, .position

/* 广告 */
.ad, .ads, .advertisement, .topAd, [class*="ad-"], [class*="advert"], [id^="ad_"], .adv, [id^="YCADS_FORM"]

/* 侧边栏 */
.sidebar, .side-bar, aside, .aside, .main-right, .conri

/* 页脚 */
footer, .footer, .foot, .bottom, .lib-foot

/* 评论区 */
#comment, .comment, .comments, .comment-list, .comment-area

/* 相关推荐 */
.related, .relatedNews, .pip, .recommend, [class*="related"]

/* 分享按钮 */
.share, .share_tool, .social-share, .bshare

/* 搜索框 */
.search

/* APP下载 */
.appLink, .openInApp, [data-statclick="downloadApp"], .top-box

/* 弹窗/遮罩 */
.cpl_popup, .popup, .mask, [class*="-mask"]

/* 付费墙 */
#chargeWall, [id^="pay-layer"]

/* 浮动元素 */
.fix-ewm, .go-top, .back-top, .float-bar

/* 无障碍提示 */
#ariaTipText, .skipAutoFix

/* iframe */
iframe

/* SEO隐藏 */
[id*="seo"], [id*="related_"]
```

### 针对每个网站的精确隐藏规则

```css
/* 财新网桌面版 */
.caixin-desktop .head,
.caixin-desktop .sitenav,
.caixin-desktop .mainnav,
.caixin-desktop .crumb,
.caixin-desktop .topAd,
.caixin-desktop .pip,
.caixin-desktop #comment,
.caixin-desktop .comment-list,
.caixin-desktop .bottom,
.caixin-desktop .share_tool,
.caixin-desktop .aitt,
.caixin-desktop .conri,
.caixin-desktop .select-text-menu,
.caixin-desktop #sina_anywhere_iframe,
.caixin-desktop #relate_subject_seo { display: none !important; }

/* 财新网移动版 */
.caixin-mobile header,
.caixin-mobile .menu-mask,
.caixin-mobile .menu-box,
.caixin-mobile .login-mask,
.caixin-mobile .login-box,
.caixin-mobile .search-mask,
.caixin-mobile .search-box,
.caixin-mobile [class*="ad-media"],
.caixin-mobile #pay-layer-ad,
.caixin-mobile #pay-layer-pro-ad,
.caixin-mobile #pay-layer-in-ad,
.caixin-mobile #chargeWall,
.caixin-mobile .top-box,
.caixin-mobile .appLink,
.caixin-mobile .openInApp,
.caixin-mobile #topboxcomment,
.caixin-mobile .cpl_popup,
.caixin-mobile #article_end_wrapper,
.caixin-mobile .other-con,
.caixin-mobile .caixin-app,
.caixin-mobile footer,
.caixin-mobile .go-top,
.caixin-mobile .addBox,
.caixin-mobile .zan_box02,
.caixin-mobile .article_topic,
.caixin-mobile .news-ad { display: none !important; }

/* 工信部 */
.miit .head,
.miit .nav,
.miit .mnav,
.miit .bottom,
.miit .mob-bottom,
.miit .related,
.miit [id^="authorizedRead_"],
.miit .share,
.miit #ewmzs,
.miit .article_fd,
.miit #ariaTipText { display: none !important; }

/* 新华网 */
.xinhua .header,
.xinhua .mheader,
.xinhua .mob-top,
.xinhua .nav,
.xinhua .topAd,
.xinhua .adv,
.xinhua [id^="YCADS_FORM"],
.xinhua .main-right,
.xinhua .relatedNews,
.xinhua .share,
.xinhua .source,
.xinhua .editor,
.xinhua .search,
.xinhua .fix-ewm,
.xinhua .foot,
.xinhua .lib-foot,
.xinhua #ariaTipText { display: none !important; }

/* 澎湃新闻移动版 */
.thepaper #wap_header,
.thepaper [data-statclick="downloadApp"],
.thepaper [class*="top_ad_articleNo"],
.thepaper [class*="footer_banner"],
.thepaper #footer,
.thepaper .adm-px-tester { display: none !important; }
```
