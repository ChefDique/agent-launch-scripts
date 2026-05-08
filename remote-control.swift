import Cocoa

class RemoteWindow: NSPanel {
    init() {
        super.init(
            contentRect: NSRect(x: 100, y: 100, width: 160, height: 38),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        self.isFloatingPanel = true
        self.level = .floating
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        self.backgroundColor = NSColor.clear
        self.isMovableByWindowBackground = true
        self.hasShadow = true
        
        let visualEffect = NSVisualEffectView(frame: self.contentView!.bounds)
        visualEffect.blendingMode = .behindWindow
        visualEffect.material = .hudWindow
        visualEffect.state = .active
        visualEffect.autoresizingMask = [.width, .height]
        visualEffect.layer?.cornerRadius = 10
        visualEffect.wantsLayer = true
        self.contentView?.addSubview(visualEffect)
        
        let stackView = NSStackView(frame: NSRect(x: 8, y: 6, width: 144, height: 26))
        stackView.orientation = .horizontal
        stackView.spacing = 4
        stackView.distribution = .fillEqually
        
        let buttons = [
            ("X", "xavier", NSColor.systemBlue),
            ("L", "lucius", NSColor.systemOrange),
            ("G", "gekko", NSColor.systemGreen),
            ("O", "overlord-swarmy", NSColor.systemCyan)
        ]
        
        for (label, id, color) in buttons {
            let btn = NSButton(title: label, target: self, action: #selector(launchAgent(_:)))
            btn.bezelStyle = .regularSquare
            btn.isBordered = false
            btn.wantsLayer = true
            btn.layer?.backgroundColor = color.withAlphaComponent(0.3).cgColor
            btn.layer?.cornerRadius = 5
            btn.identifier = NSUserInterfaceItemIdentifier(id)
            btn.toolTip = "Deploy \(id.capitalized)"
            
            let style = NSMutableParagraphStyle()
            style.alignment = .center
            btn.attributedTitle = NSAttributedString(string: label, attributes: [
                .foregroundColor: NSColor.white,
                .font: NSFont.boldSystemFont(ofSize: 12),
                .paragraphStyle: style
            ])
            
            stackView.addArrangedSubview(btn)
        }
        
        self.contentView?.addSubview(stackView)
    }
    
    @objc func launchAgent(_ sender: NSButton) {
        let id = sender.identifier?.rawValue ?? ""
        let task = Process()
        task.launchPath = "/usr/bin/env"
        let home = NSHomeDirectory()
        let runtime = ProcessInfo.processInfo.environment["AGENTREMOTE_SWARMY_RUNTIME"]
            ?? "\(home)/ai_projects/swarmy/scripts/agentremote_runtime.py"
        
        task.arguments = ["python3", runtime, "add", id]
        
        try? task.run()
        
        let originalColor = sender.layer?.backgroundColor
        sender.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.9).cgColor
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            sender.layer?.backgroundColor = originalColor
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: RemoteWindow?
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = RemoteWindow()
        window?.center()
        window?.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.accessory)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
