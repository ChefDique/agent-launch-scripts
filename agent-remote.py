import tkinter as tk
import subprocess
import os

class AgentRemote:
    def __init__(self, root):
        self.root = root
        self.root.title("Agents")
        self.root.attributes('-topmost', True)
        self.root.overrideredirect(True)
        self.root.geometry("260x50+100+100") 
        self.root.configure(bg='#050505')

        self.selected = {
            "xavier": False,
            "lucius": False,
            "gekko": False,
            "swarmy": False
        }
        
        self.colors = {
            "xavier": "#00a2ff",
            "lucius": "#ffaa00",
            "gekko": "#00ff88",
            "swarmy": "#00ffff"
        }

        # Draggable logic
        self.root.bind("<ButtonPress-1>", self.start_move)
        self.root.bind("<ButtonRelease-1>", self.stop_move)
        self.root.bind("<B1-Motion>", self.on_move)

        self.frame = tk.Frame(self.root, bg='#050505', highlightthickness=1, highlightbackground='#222')
        self.frame.pack(expand=True, fill='both')

        self.btns = {}
        agents = [
            ("X", "xavier"),
            ("L", "lucius"),
            ("G", "gekko"),
            ("S", "swarmy")
        ]

        for label, id in agents:
            b = tk.Button(self.frame, text=label, bg='#111', fg='#444', 
                          activebackground='#222', activeforeground='#fff',
                          font=('Inter', 12, 'bold'),
                          highlightthickness=0, bd=0, width=3, height=2,
                          command=lambda i=id: self.toggle(i))
            b.pack(side='left', padx=3, pady=4)
            self.btns[id] = b

        self.spawn_btn = tk.Button(self.frame, text="SPAWN", bg='#222', fg='#fff',
                                  font=('Inter', 10, 'bold'),
                                  highlightthickness=0, bd=0, width=6, height=2,
                                  command=self.spawn)
        self.spawn_btn.pack(side='right', padx=6, pady=4)

    def toggle(self, agent_id):
        self.selected[agent_id] = not self.selected[agent_id]
        color = self.colors[agent_id] if self.selected[agent_id] else '#444'
        bg = '#1a1a1a' if self.selected[agent_id] else '#111'
        self.btns[agent_id].config(fg=color, bg=bg)

    def spawn(self):
        active = [k for k, v in self.selected.items() if v]
        if not active:
            return
            
        home = os.path.expanduser("~")
        # Build the chq-tmux command with all selected agents
        cmd = ["bash", f"{home}/agent-launch-scripts/chq-tmux.sh", "start"] + active
        
        # Launch and reset selections
        subprocess.Popen(cmd, start_new_session=True)
        
        # Visual feedback on Spawn button
        self.spawn_btn.config(bg='#fff', fg='#000')
        self.root.after(200, lambda: self.spawn_btn.config(bg='#222', fg='#fff'))
        
        # Reset all toggles after spawn
        for agent_id in self.selected:
            self.selected[agent_id] = False
            self.btns[agent_id].config(fg='#444', bg='#111')

    def start_move(self, event):
        self.root.x = event.x
        self.root.y = event.y

    def stop_move(self, event):
        self.root.x = None
        self.root.y = None

    def on_move(self, event):
        deltax = event.x - self.root.x
        deltay = event.y - self.root.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AgentRemote(root)
    root.mainloop()
