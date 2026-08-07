import os
import re

frontend_dir = r"c:\Users\Admin\Downloads\Telegram Desktop\Smart-Attendance-System-Using-Face-Recognition-main\frontend"
pattern = re.compile(r'href="css/dashboard\.css\?v=[0-9.]+"')

for filename in os.listdir(frontend_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(frontend_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = pattern.sub('href="css/dashboard.css?v=2.4"', content)
        
        if new_content != content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Updated {filename}")
