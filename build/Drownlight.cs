using System;
using System.IO;
using System.Reflection;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

/* 版本信息：和 git tag / README 保持一致，右键 exe → 属性 → 详细信息能看到 */
[assembly: AssemblyTitle("Drownlight")]
[assembly: AssemblyProduct("光溺 Drownlight")]
[assembly: AssemblyDescription("Deep-sea sonar shooter. Zero assets - all art and audio generated at runtime.")]
[assembly: AssemblyCompany("Drownlight")]
[assembly: AssemblyCopyright("MIT License")]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: AssemblyFileVersion("0.1.0.0")]
[assembly: AssemblyInformationalVersion("0.1.0")]

namespace Drownlight
{
    static class Program
    {
        public static string BaseDir;
        public static string AppDir;

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool SetDllDirectory(string lpPathName);

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        static extern int SetCurrentProcessExplicitAppUserModelID(string appID);

        [STAThread]
        static void Main(string[] args)
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveEmbedded;

            try { Run(args); }
            catch (Exception ex)
            {
                try
                {
                    string p = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "Drownlight", "crash.txt");
                    Directory.CreateDirectory(Path.GetDirectoryName(p));
                    File.WriteAllText(p, DateTime.Now + "\r\n" + ex.ToString());
                }
                catch { }
                MessageBox.Show(ex.ToString(), "光溺 · 启动失败");
            }
        }

        /* WebView2 的托管 DLL 内嵌在 exe 里，运行时按需装载 */
        static Assembly ResolveEmbedded(object sender, ResolveEventArgs ev)
        {
            string name = new AssemblyName(ev.Name).Name;
            string res = null;
            if (name == "Microsoft.Web.WebView2.Core") res = "lib.WebView2.Core.dll";
            else if (name == "Microsoft.Web.WebView2.WinForms") res = "lib.WebView2.WinForms.dll";
            if (res == null) return null;
            var asm = Assembly.GetExecutingAssembly();
            using (var st = asm.GetManifestResourceStream(res))
            {
                if (st == null) return null;
                var buf = new byte[st.Length];
                int read = 0;
                while (read < buf.Length) read += st.Read(buf, read, buf.Length - read);
                return Assembly.Load(buf);
            }
        }

        /* 在 Windows「图形性能首选项」里把自己登记为【高性能】，
           这样系统会优先把独显分给这个进程（下次启动生效） */
        static void PreferHighPerformanceGpu()
        {
            try
            {
                string exe = Assembly.GetExecutingAssembly().Location;
                using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(
                    @"Software\Microsoft\DirectX\UserGpuPreferences"))
                {
                    if (key != null)
                        key.SetValue(exe, "GpuPreference=2;", Microsoft.Win32.RegistryValueKind.String);
                }
            }
            catch { }
        }

        static void Run(string[] args)
        {
            /* 任务栏把它当成独立应用（自己的图标、自己的分组），
               否则 WebView2 宿主容易和别的 Chromium 进程混在一起 */
            try { SetCurrentProcessExplicitAppUserModelID("Drownlight.Game.1"); } catch { }
            PreferHighPerformanceGpu();
            string shot = null;
            string query = "";
            string probe = null;
            string probeJs = null;
            string profile = null;
            int probeWait = 2200;
            int shotWait = 2200;
            bool dev = false;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--selftest" && i + 1 < args.Length) shot = args[++i];
                else if (args[i] == "--query" && i + 1 < args.Length) query = args[++i];
                else if (args[i] == "--probe" && i + 1 < args.Length) probe = args[++i];
                else if (args[i] == "--probejs" && i + 1 < args.Length) probeJs = args[++i];
                else if (args[i] == "--probewait" && i + 1 < args.Length) probeWait = int.Parse(args[++i]);
                else if (args[i] == "--shotwait" && i + 1 < args.Length) shotWait = int.Parse(args[++i]);
                else if (args[i] == "--profile" && i + 1 < args.Length) profile = args[++i];
                else if (args[i] == "--dev") dev = true;
            }

            /* --profile 用独立存档目录，跑自动化测试时不要污染玩家存档 */
            BaseDir = string.IsNullOrEmpty(profile)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Drownlight")
                : Path.GetFullPath(profile);
            string binDir = Path.Combine(BaseDir, "bin");
            Directory.CreateDirectory(binDir);
            Directory.CreateDirectory(Path.Combine(BaseDir, "udf"));

            if (dev)
            {
                // 开发模式：直接读 exe 所在目录的源码，改完刷新即可看到
                AppDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            }
            else
            {
                AppDir = Path.Combine(BaseDir, "app");
                Directory.CreateDirectory(AppDir);
                ExtractApp();
            }

            ExtractLoader(binDir);
            SetDllDirectory(binDir);

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new GameForm(shot, query, probe, probeJs, probeWait, shotWait));
            Environment.Exit(0);
        }

        /* WebView2Loader.dll 必须能被 P/Invoke 找到 */
        static void ExtractLoader(string binDir)
        {
            var asm = Assembly.GetExecutingAssembly();
            const string name = "WebView2Loader.dll";
            string target = Path.Combine(binDir, name);
            using (var s = asm.GetManifestResourceStream(name))
            {
                if (s == null) return;
                if (File.Exists(target) && new FileInfo(target).Length == s.Length) return;
                using (var f = File.Create(target)) s.CopyTo(f);
            }
        }

        /* 把内嵌的游戏文件解出来 */
        static void ExtractApp()
        {
            var asm = Assembly.GetExecutingAssembly();
            foreach (var name in asm.GetManifestResourceNames())
            {
                if (!name.StartsWith("res/")) continue;
                string rel = name.Substring(4).Replace('/', Path.DirectorySeparatorChar);
                string target = Path.Combine(AppDir, rel);
                string dir = Path.GetDirectoryName(target);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                using (var s = asm.GetManifestResourceStream(name))
                {
                    if (s == null) continue;
                    if (File.Exists(target) && new FileInfo(target).Length == s.Length) continue;
                    using (var f = File.Create(target)) s.CopyTo(f);
                }
            }
        }
    }

    class GameForm : Form
    {
        WebView2 wv;
        string shotPath;
        string query;
        bool fullscreen;
        string probePath, probeJs;
        int probeWait, shotWait;

        public GameForm(string shot, string q, string probe, string pjs, int pwait, int swait)
        {
            shotPath = shot;
            query = q ?? "";
            probePath = probe;
            probeJs = pjs;
            probeWait = pwait;
            shotWait = swait;

            Text = "光溺 DROWNLIGHT";
            BackColor = Color.FromArgb(2, 6, 12);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            MinimumSize = new Size(960, 540);
            KeyPreview = true;
            DoubleBuffered = true;

            wv = new WebView2();
            wv.Dock = DockStyle.Fill;
            wv.DefaultBackgroundColor = Color.FromArgb(2, 6, 12);
            Controls.Add(wv);

            Load += (s, e) => { Init(); };
        }

        /* 窗口图标：任务栏、Alt-Tab、任务管理器都取这里。
           不设的话 WinForms 会给你那个默认的“小窗口”图标。 */
        Icon bigIcon, smallIcon;

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        const int WM_SETICON = 0x0080;
        const int ICON_SMALL = 0;

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var st = asm.GetManifestResourceStream("app.ico"))
                {
                    if (st == null) return;
                    bigIcon = new Icon(st, 32, 32);
                    st.Position = 0;
                    smallIcon = new Icon(st, 16, 16);
                }
                Icon = bigIcon;
                SendMessage(Handle, WM_SETICON, (IntPtr)ICON_SMALL, smallIcon.Handle);
            }
            catch { }
        }

        async void Init()
        {
            try
            {
                /* 尽量让 Chromium 用独显：GPU 相关开关直接传给 WebView2。
                   --force_high_performance_gpu 会让 ANGLE 优先挑高性能适配器 */
                var envOpts = new CoreWebView2EnvironmentOptions(
                    "--force_high_performance_gpu --ignore-gpu-blocklist --enable-gpu-rasterization",
                    null, null, false, null);
                var env = await CoreWebView2Environment.CreateAsync(
                    null, Path.Combine(Program.BaseDir, "udf"), envOpts);
                await wv.EnsureCoreWebView2Async(env);

                var core = wv.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsZoomControlEnabled = false;

                core.SetVirtualHostNameToFolderMapping(
                    "drownlight.local", Program.AppDir, CoreWebView2HostResourceAccessKind.Allow);

                /* 全屏由页面通过 postMessage 请求，宿主只负责把窗口变成无边框全屏。
                   刻意不走 DOM Fullscreen API —— 那条路上 Chromium 会把 Esc 当成
                   “退出全屏”，一按暂停就掉出全屏。 */
                core.WebMessageReceived += (s, e) =>
                {
                    string m = null;
                    try { m = e.TryGetWebMessageAsString(); }
                    catch { }
                    if (m == "fs:1") SetFullscreen(true);
                    else if (m == "fs:0") SetFullscreen(false);
                    else if (m == "quit") Quit();
                };

                core.NavigationCompleted += async (s, e) =>
                {
                    if (shotPath == null && probePath == null) return;
                    try
                    {
                        if (probePath != null)
                        {
                            await Task.Delay(probeWait);
                            string r = await core.ExecuteScriptAsync(probeJs ?? "null");
                            File.WriteAllText(probePath, r ?? "");
                        }
                        if (shotPath != null)
                        {
                            await Task.Delay(shotWait);
                            using (var f = File.Create(shotPath))
                            {
                                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, f);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        try { File.WriteAllText((shotPath ?? probePath) + ".err.txt", ex.ToString()); } catch { }
                    }
                    Close();
                };

                string url = "https://drownlight.local/index.html";
                if (!string.IsNullOrEmpty(query)) url += query;
                wv.Source = new Uri(url);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "无法启动 WebView2 运行时：\n" + ex.Message +
                    "\n\n请安装 Microsoft Edge WebView2 Runtime 后重试。",
                    "光溺");
                Close();
            }
        }

        /* 页面点“退出游戏”：先把当前这条 WebMessage 处理完，再关窗口，
           避免在 WebView2 自己的回调里 Dispose 掉控制器 */
        void Quit()
        {
            BeginInvoke(new Action(delegate
            {
                try { if (wv.CoreWebView2 != null) wv.Dispose(); } catch { }
                try { Close(); } catch { }
                Application.Exit();
            }));
        }

        void SetFullscreen(bool on)
        {
            if (on == fullscreen) return;
            fullscreen = on;
            if (on)
            {
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
                TopMost = true;
            }
            else
            {
                TopMost = false;
                FormBorderStyle = FormBorderStyle.Sizable;
                WindowState = FormWindowState.Maximized;
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F11)
            {
                bool on = !fullscreen;
                SetFullscreen(on);
                try
                {
                    wv.CoreWebView2.ExecuteScriptAsync(
                        "window.DL&&DL.fs&&DL.fs.setFromHost?DL.fs.setFromHost(" + (on ? "true" : "false") + "):0");
                }
                catch { }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }
    }
}
