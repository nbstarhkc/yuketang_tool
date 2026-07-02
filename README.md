# 雨课堂挂机脚本

这是一个用于雨课堂的挂机辅助脚本集合，包含了大纲页多开协调和视频自动播放加速的功能。

## 目录
- [如何获取课程链接](#如何获取课程链接)
- [如何安装和启动脚本](#如何安装和启动脚本)
- [脚本说明](#脚本说明)

## 如何获取课程链接
如果您在电脑端无法直接找到对应的课程，可以通过微信端获取链接并在电脑浏览器中打开：

1. **进入微信服务号**：在微信搜索“雨课堂”，点击进入服务号“雨课堂”。
<img src="images/step_search.png" width="300" alt="步骤1">

2. **找到课程**：在底部菜单点击“我的”，找到您要观看的课程并点击进入。
<img src="images/step_course.png" width="300" alt="步骤2">

3. **复制链接**：在课程页面右上角点击菜单，选择“复制链接”。
<img src="images/step_link.png" width="300" alt="步骤3">

4. **浏览器中打开**：将复制的链接发送到电脑，并在电脑浏览器中粘贴打开，登录后选择自己要刷的课程。

## 如何安装和启动脚本

### 第一步：安装脚本管理器
为了使用本脚本，您需要一个支持用户脚本（UserScript）的浏览器扩展程序。
推荐使用 **Tampermonkey**（篡改猴）：
- [Chrome 商店下载链接](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Edge 商店下载链接](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 第二步：安装脚本
安装好 Tampermonkey 扩展后，您可以直接点击下方链接安装脚本（建议**鼠标中键点击**或**右键选择在新标签页中打开**，以免覆盖当前页面）：

1. **[👉 点击安装：1_大纲页多开协调器](https://raw.githubusercontent.com/nbstarhkc/yuketang_tool/main/1_%E5%A4%A7%E7%BA%B2%E9%A1%B5%E5%A4%9A%E5%BC%80%E5%8D%8F%E8%B0%83%E5%99%A8.user.js)**
2. **[👉 点击安装：2_视频自动播放加速助手](https://raw.githubusercontent.com/nbstarhkc/yuketang_tool/main/2_%E8%A7%86%E9%A2%91%E8%87%AA%E5%8A%A8%E6%92%AD%E6%94%BE%E5%8A%A0%E9%80%9F%E5%8A%A9%E6%89%8B.user.js)**

   > **💡 提示**：点击安装链接后，浏览器可能会先短暂显示全是代码的页面，这是正常的。只需稍微等待几秒钟，Tampermonkey 安装界面就会自动弹出来。

### 第三步：启动运行
1. 确保两个脚本在浏览器的 Tampermonkey 管理面板中都处于 **“启用”** 状态。
2. 回到您在浏览器中打开的雨课堂课程页面，**刷新页面**，脚本将自动启动运行。

## 脚本说明
- **1_大纲页多开协调器.user.js**: 负责在课程大纲页面协调多个任务的执行，辅助多开。
- **2_视频自动播放加速助手.user.js**: 负责进入视频页面后，自动播放视频、处理弹题、并按设定进行加速。
