# -*- coding: utf-8 -*-
"""
SafeSolo - ADB Auto Connect & Device Pairing Manager
Tự động dò tìm cổng, ghi nhớ và kết nối Điện thoại (A71) & Galaxy Watch (SM-R900)
"""

import sys
import os
import time
import socket
import subprocess
import argparse
from concurrent.futures import ThreadPoolExecutor

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ADB_PATH = r"C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not os.path.exists(ADB_PATH):
    ADB_PATH = "adb"

PHONE_IPS = ["192.168.1.12", "192.168.1.8"]
WATCH_IPS = ["192.168.1.7", "192.168.1.9"]
WATCH_IP = "192.168.1.7"

def run_adb(args, timeout=10):
    cmd = [ADB_PATH] + args
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout)
        return res.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

def is_port_open(ip, port, timeout=0.15):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        if s.connect_ex((ip, port)) == 0:
            return True
    except:
        pass
    finally:
        s.close()
    return False

def find_active_port(ip, port_range=(32000, 47000)):
    # 1. Thử port 5555 chuẩn và các cổng gần nhất trước (rất nhanh)
    for quick_p in [5555, 38235, 41815]:
        if is_port_open(ip, quick_p, timeout=0.25):
            return quick_p
    
    # 2. Quét đa luồng dải Wireless Debugging
    with ThreadPoolExecutor(max_workers=200) as executor:
        futures = {executor.submit(is_port_open, ip, p, 0.15): p for p in range(port_range[0], port_range[1])}
        for f in futures:
            if f.result():
                executor.shutdown(wait=False, cancel_futures=True)
                return futures[f]
    return None

def get_connected_devices():
    output = run_adb(["devices", "-l"])
    connected = []
    for line in output.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            connected.append(parts[0])
    return connected

def connect_device(name, ip, explicit_port=None):
    print(f"\n[*] Đang kiểm tra {name} ({ip})...")
    port = explicit_port or find_active_port(ip)
    if not port:
        print(f"    [-] Không tìm thấy cổng mở trên {ip}.")
        print(f"        -> Vui lòng kiểm tra: 'Gỡ lỗi qua Wi-Fi' đã BẬT và màn hình sáng chưa.")
        return False
    
    print(f"    [+] Tìm thấy {name} đang mở cổng: {port}")
    target = f"{ip}:{port}"
    res = run_adb(["connect", target])
    print(f"    -> ADB Connect: {res}")
    
    # Cố định về port 5555 để các công cụ ghi nhớ mãi mãi
    if port != 5555:
        print(f"    [*] Đang ghim cổng cố định 5555 để ghi nhớ thiết bị...")
        run_adb(["-s", target, "tcpip", "5555"])
        time.sleep(1)
        res5555 = run_adb(["connect", f"{ip}:5555"])
        print(f"    -> Đã ghi nhớ cổng cố định 5555: {res5555}")
        active_target = f"{ip}:5555"
    else:
        active_target = target

    # Cấu hình reverse port 4000 cho Backend SafeSolo
    print(f"    [*] Cấu hình Reverse Port 4000 (Backend SafeSolo)...")
    rev = run_adb(["-s", active_target, "reverse", "tcp:4000", "tcp:4000"])
    print(f"    -> Reverse: {rev if rev else 'OK'}")
    return True

def pair_wizard():
    print("\n" + "="*65)
    print("      HƯỚNG DẪN GHÉP NỐI THIẾT BỊ LẦN ĐẦU (PAIRING)")
    print("="*65)
    print("1. Trên màn hình 'Gỡ lỗi qua Wi-Fi' của Điện thoại / Đồng hồ:")
    print("   Bấm: 'Ghép nối thiết bị bằng mã ghép nối' (Pair device with pairing code).")
    print("2. Hộp thoại trên máy sẽ hiển thị:")
    print("   - Địa chỉ IP & Cổng ghép nối (Ví dụ: 192.168.1.7:39485)")
    print("   - Mã ghép nối Wi-Fi (6 chữ số)")
    print("-"*65)
    print("[1] Đồng hồ Galaxy Watch (SM-R900 - IP mặc định: 192.168.1.7)")
    print("[2] Điện thoại Samsung A71 (IP mặc định: 192.168.1.12)")
    print("[3] Nhập địa chỉ IP khác")
    dev_choice = input(">> Chọn thiết bị cần ghép nối [1-3] (Mặc định: 1): ").strip()
    
    if dev_choice == "2":
        default_ip = "192.168.1.12"
        dev_name = "Điện thoại Samsung A71"
    elif dev_choice == "3":
        default_ip = input(">> Nhập IP thiết bị: ").strip()
        dev_name = "Thiết bị tùy chỉnh"
    else:
        default_ip = "192.168.1.7"
        dev_name = "Đồng hồ Galaxy Watch (SM-R900)"
        
    port_input = input(f">> Nhập CỔNG GHÉP NỐI (5 số cuối sau dấu hai chấm, VD 39485): ").strip()
    if not port_input:
        print("[-] Bạn chưa nhập cổng ghép nối!")
        return
        
    target_pair = f"{default_ip}:{port_input}" if ":" not in port_input else port_input
    code_input = input(">> Nhập MÃ GHÉP NỐI 6 CHỮ SỐ: ").strip()
    if not code_input:
        print("[-] Bạn chưa nhập mã ghép nối!")
        return
        
    print(f"\n[*] Đang gửi yêu cầu ghép nối tới {target_pair} với mã {code_input}...")
    pair_res = run_adb(["pair", target_pair, code_input])
    print(f"-> Kết quả: {pair_res}")
    
    if "Successfully paired" in pair_res or "paired" in pair_res.lower():
        print(f"[+] Ghép nối thành công {dev_name}! Máy tính đã được ghi nhớ vĩnh viễn.")
        ip_only = target_pair.split(":")[0]
        time.sleep(1)
        connect_device(dev_name, ip_only)
    else:
        print("[-] Ghép nối chưa thành công. Vui lòng kiểm tra lại mã số hoặc đảm bảo màn hình thiết bị đang sáng.")

def run_once():
    print("="*65)
    print("        SAFESOLO - TỰ ĐỘNG DÒ TÌM & KẾT NỐI THIẾT BỊ KHÔNG DÂY")
    print("="*65)
    
    p_ok = False
    for p_ip in PHONE_IPS:
        if connect_device(f"Điện thoại Samsung A71 ({p_ip})", p_ip):
            p_ok = True
            break
            
    w_ok = False
    for w_ip in WATCH_IPS:
        if connect_device(f"Đồng hồ Galaxy Watch (SM-R900 - {w_ip})", w_ip):
            w_ok = True
            break
    
    print("\n" + "="*65)
    print("               DANH SÁCH THIẾT BỊ HIỆN TẠI TRONG ADB")
    print("="*65)
    print(run_adb(["devices", "-l"]))
    print("="*65)
    
    if not w_ok:
        print("\n[!] MẸO CHO ĐỒNG HỒ GALAXY WATCH:")
        print(" - Nếu đồng hồ chưa từng ghép nối với máy tính này (màn hình có chữ")
        print("   'Ghép đôi thiết bị mới'): hãy chạy tùy chọn Ghép nối (Pairing) 1 lần duy nhất.")
        print(" - Đảm bảo màn hình đồng hồ đang SÁNG và cùng bắt Wi-Fi giống máy tính.")

def monitor_mode():
    print("="*65)
    print("   SAFESOLO AUTO-CONNECTOR (CHẾ ĐỘ TỰ ĐỘNG CHẠY NGẦM LIÊN TỤC)")
    print("   Khi bạn gạt BẬT 'Gỡ lỗi qua Wi-Fi' trên Điện thoại / Đồng hồ,")
    print("   hệ thống sẽ tự động bắt tín hiệu và kết nối ngay lập tức!")
    print("="*65)
    print("[*] Đang giám sát thiết bị... Nhấn Ctrl+C để thoát.\n")
    
    while True:
        try:
            connected = get_connected_devices()
            phone_connected = any(p_ip in d for p_ip in PHONE_IPS for d in connected)
            watch_connected = any(WATCH_IP in d for d in connected)
            
            if not phone_connected:
                # Kiểm tra xem điện thoại có đang mở port không
                for p_ip in PHONE_IPS:
                    port = find_active_port(p_ip)
                    if port:
                        print(f"\n[PHÁT HIỆN] Điện thoại A71 vừa bật Wi-Fi Debugging ({p_ip}) ở cổng {port}!")
                        connect_device(f"Điện thoại Samsung A71 ({p_ip})", p_ip, port)
                        break
                    
            if not watch_connected:
                port = find_active_port(WATCH_IP)
                if port:
                    print(f"\n[PHÁT HIỆN] Đồng hồ Galaxy Watch vừa bật Wi-Fi Debugging ở cổng {port}!")
                    connect_device("Đồng hồ Galaxy Watch", WATCH_IP)
                    
            time.sleep(3)
        except KeyboardInterrupt:
            print("\nĐã dừng chế độ tự động giám sát.")
            break
        except Exception as e:
            time.sleep(3)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SafeSolo ADB Auto Connect")
    parser.add_argument("--pair", action="store_true", help="Mở hướng dẫn ghép đôi (Pairing) lần đầu")
    parser.add_argument("--watch", action="store_true", help="Chế độ giám sát tự động kết nối ngầm")
    args = parser.parse_args()
    
    if args.pair:
        pair_wizard()
    elif args.watch:
        monitor_mode()
    else:
        run_once()
