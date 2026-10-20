# Third-party notices

光溺 Drownlight 的**游戏本体没有任何第三方素材**：没有图片、字体、音频文件或外部 JS 库，
所有画面与声音都在运行时生成（Canvas 2D 路径与渐变、WebAudio 合成）。

仓库里唯一的第三方二进制是 Windows 外壳用到的 WebView2 SDK：

| 文件 | 版本 | 来源 | 用途 |
|---|---|---|---|
| `build/refs/WebView2.Core.dll` | 1.0.4258.31 | NuGet `Microsoft.Web.WebView2` | WebView2 托管 API |
| `build/refs/WebView2.WinForms.dll` | 1.0.4258.31 | NuGet `Microsoft.Web.WebView2` | WinForms 控件封装 |
| `build/refs/WebView2Loader.dll` | 1.0.4258.31 | NuGet `Microsoft.Web.WebView2` | 原生 loader（P/Invoke） |

- 版权归 Microsoft Corporation 所有，按该 NuGet 包自带的许可条款随本程序一同分发。
  许可全文见包内 `LICENSE.txt`：<https://www.nuget.org/packages/Microsoft.Web.WebView2>
- 这三个 DLL 在构建时被内嵌进 `光溺.exe`（`WebView2Loader.dll` 还会在首次运行时解出到用户目录）。
- **WebView2 Runtime 本身不随本程序分发**，由系统提供（Windows 11 自带；Windows 10 安装 Edge 后即有）。

其他：

- `git` 构建脚本使用 Windows 自带的 .NET Framework 4.8 编译器（`csc.exe`），不涉及额外分发。
- `docs/shots/` 里的截图是游戏自身的画面，与代码同许可（MIT）。
