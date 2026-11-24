import UIKit
import WebKit
import Capacitor

class DealChaserViewController: CAPBridgeViewController {
    private var launchOverlay: UIView?
    private var readinessTimer: Timer?

    private static let slateDark = UIColor(red: 2.0 / 255.0, green: 6.0 / 255.0, blue: 23.0 / 255.0, alpha: 1.0)
    private static let emeraldAccent = UIColor(red: 16.0 / 255.0, green: 185.0 / 255.0, blue: 129.0 / 255.0, alpha: 1.0)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.slateDark
        webView?.isOpaque = false
        webView?.backgroundColor = Self.slateDark
        webView?.scrollView.backgroundColor = Self.slateDark
        showLaunchOverlay()
        startReadinessPolling()
    }

    private func showLaunchOverlay() {
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = Self.slateDark

        let imageView = UIImageView(image: UIImage(named: "Splash"))
        imageView.contentMode = .scaleAspectFill
        imageView.frame = overlay.bounds
        imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.addSubview(imageView)

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = Self.emeraldAccent
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        overlay.addSubview(spinner)

        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: 130)
        ])

        view.addSubview(overlay)
        launchOverlay = overlay
    }

    private func startReadinessPolling() {
        var elapsedTicks = 0
        readinessTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            elapsedTicks += 1

            // Safety max wait (~8s) so overlay can never stay stuck
            if elapsedTicks > 65 {
                timer.invalidate()
                self.dismissLaunchOverlay()
                return
            }

            guard let wv = self.webView, !wv.isLoading else { return }
            wv.evaluateJavaScript("Boolean(document.getElementById('root') && document.getElementById('root').childElementCount > 0)") { result, _ in
                if let ready = result as? Bool, ready {
                    timer.invalidate()
                    DispatchQueue.main.async {
                        self.dismissLaunchOverlay()
                    }
                }
            }
        }
    }

    private func dismissLaunchOverlay() {
        guard let overlay = launchOverlay else { return }
        launchOverlay = nil
        UIView.animate(withDuration: 0.25, animations: {
            overlay.alpha = 0
        }, completion: { _ in
            overlay.removeFromSuperview()
        })
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let slateDark = UIColor(red: 2.0 / 255.0, green: 6.0 / 255.0, blue: 23.0 / 255.0, alpha: 1.0)
        let win = UIWindow(windowScene: windowScene)
        win.backgroundColor = slateDark
        win.rootViewController = DealChaserViewController()
        win.makeKeyAndVisible()
        self.window = win

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
