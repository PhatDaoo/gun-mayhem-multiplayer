# Gun Mayhem 2: More Mayhem — Native HTML5 & Phone Console

Phiên bản web clone hoàn chỉnh của tựa game đối kháng platformer kinh điển **Gun Mayhem 2: More Mayhem**, được tái xây dựng hoàn toàn bằng **HTML5 Canvas + JavaScript ES Modules thuần** (không còn phụ thuộc trình giả lập Flash/Ruffle), giữ nguyên toàn bộ tài nguyên đồ họa và âm thanh gốc từ file SWF, đồng thời tích hợp hệ thống **Phone Console** biến tối đa 4 điện thoại thành tay cầm không dây qua **mã QR + WebRTC (PeerJS)**.

---

## 1. Công nghệ & Ngôn ngữ sử dụng

| Thành phần | Công nghệ / Ngôn ngữ | Vai trò |
| :--- | :--- | :--- |
| **Giao diện (UI)** | **HTML5, CSS3** | Màn hình Host (`index.html`), tay cầm điện thoại (`controller.html`) và style (`css/style.css`). |
| **Game Engine** | **JavaScript (ES Modules thuần)** | Kiến trúc module tách biệt trong `js/`, chạy trực tiếp trên trình duyệt không cần bundler hay framework ngoài. |
| **Đồ họa** | **HTML5 Canvas 2D** | Kết xuất 3 lớp bản đồ parallax, ghép nhân vật đa bộ phận (part-based sprites) theo đúng tâm xoay (`ox`, `oy`) trích xuất từ SWF gốc (`sprites/`). |
| **Âm thanh** | **HTML5 Audio (`js/sound.js`)** | Quản lý audio pool phát 63 file `.mp3`/`.wav` gốc (tiếng từng loại súng, nổ, rơi sàn, va chạm và 3 bản nhạc nền). |
| **Multiplayer P2P** | **PeerJS `1.5.1` (WebRTC DataChannel)** | Kết nối trực tiếp P2P giữa màn hình PC (Host) và tối đa 4 điện thoại (Controller), không cần backend xử lý tín hiệu điều khiển. |
| **QR Pairing** | **QRCode.js `1.0.0`** | Tạo mã QR động chứa link `?host=<peerId>` để điện thoại quét và ghép nối ngay lập tức. |
| **Mobile Web APIs** | **Vibration API, Fullscreen API, `localStorage`** | Rung phản hồi (`haptic`) khi bắn/trúng đạn/nổ/chết, tự động toàn màn hình và lưu bố cục tay cầm + cấu hình người chơi. |
| **Local Server** | **Node.js `http` (`server.js`)** | Static HTTP server thuần (0 dependency) phục vụ chạy local tại `http://localhost:3000`. |

---

## 2. Cấu trúc thư mục dự án (~20.1 MB)

```text
gun-mayhem-multiplayer-main/
├── index.html          # Màn hình chính Host (QR Lobby, Main Menu, Setup, Campaign, HUD, Modals)
├── controller.html     # Tay cầm điện thoại (Chọn Slot, Analog Joystick, Edit Layout, Live HUD)
├── css/
│   └── style.css       # Giao diện menu, thẻ setup 4 người, HUD trận đấu, bảng tổng kết & modal
├── js/
│   ├── gamedata.js     # Dữ liệu gốc trích xuất từ SWF: 86 súng, 22 map, 48 mũ, 27 áo, 12 mặt, 13 perks, 16 campaign
│   ├── assets.js       # Bộ tải ảnh & hàm vẽ sprite chuẩn tọa độ tâm xoay (ox, oy)
│   ├── sound.js        # Bộ phát âm thanh pool & nhạc nền gốc
│   ├── input.js        # Hợp nhất input từ 4 bộ phím PC và tối đa 4 tay cầm WebRTC
│   ├── network.js      # Quản lý WebRTC Host, slot P1–P4, đồng bộ HUD & gửi lệnh rung (haptic)
│   ├── entities.js     # Thực thể Player, Bullet, Grenade, DuckyBomb, Crate, Powerup, MysteryBox & vật lý
│   ├── ai.js           # AI Bot (tìm mục tiêu, dò mép vực, nhảy tầng, né đạn & né lựu đạn)
│   ├── renderer.js     # Bộ vẽ Canvas 2D (parallax map, ghép part nhân vật, khiên, thời tiết, mũi tên ngoài màn hình)
│   └── main.js         # Vòng lặp 35 FPS fixed-timestep, điều phối 7 chế độ chơi, Campaign, Weapon Library & UI
├── sprites/            # 116 thư mục sprite PNG gốc cần thiết (15.26 MB)
├── sounds/             # 63 file âm thanh & nhạc nền gốc (4.55 MB)
├── icon.jpg            # Biểu tượng trang web
├── package.json        # Khai báo script khởi động (0 dependency)
├── server.js           # Static HTTP server thuần Node.js
└── start.bat           # Script khởi chạy nhanh trên Windows
```

---

## 3. Thiết kế Giao diện (UI / UX)

### 3.1. Màn hình Host (`index.html` & `css/style.css`)
* **Floating QR Lobby (`#lobby`)**: Nằm góc trên bên trái, hiển thị trạng thái kết nối 4 slot P1–P4, mã QR và link mở tab tay cầm test nhanh; tự động thu gọn khi vào trận đấu.
* **Main Menu**: Chạy chế độ *Attract Mode* (2 AI Bot tự giao chiến trực tiếp trên nền bản đồ ngẫu nhiên).
* **Custom Game Setup (1–4P)**:
  * 4 thẻ người chơi có `<canvas>` xem trước nhân vật trực tiếp; chuyển đổi linh hoạt giữa `HUMAN`, `AI BOT` và `SLOT EMPTY`.
  * Tùy biến **20 màu da**, **48 mũ**, **12 khuôn mặt**, **27 áo**, **7 súng khởi đầu**, **13 Perks** và chọn Team A/B (khi đấu đội).
  * Chọn **21 bản đồ** (+ 2 chế độ Random: *New Maps* / *All Maps*), **7 chế độ chơi**, số mạng (`Lives`) và bật/tắt `Crates` / `Powerups`.
* **Campaign (16 Missions)**: Danh sách 16 màn chơi theo cốt truyện gốc (từ *Tutorial* đến *Final Test*), lưu tiến độ hoàn thành vào `localStorage` (`gm_campaign_done`) và hỗ trợ **Co-op 2 người**.
* **Weapon Library**: Phân loại **86 vũ khí** theo 6 nhóm (`HANDGUNS`, `SMGs`, `SNIPERS`, `SHOTGUNS`, `ARs/LMGs`, `OTHER`) kèm thanh chỉ số, nút nghe thử tiếng súng và nút **Bắn thử** ngay trên *Weapon Testing Level* (Map 22).
* **In-Game HUD & Post-Game Summary**: Killfeed thời gian thực, thẻ trạng thái mạng/súng/đạn/bom của từng người chơi và bảng tổng kết cuối trận (`Kills`, `Deaths`, `K/D`, `Accuracy`, `Pickups`).

### 3.2. Tay cầm Điện thoại (`controller.html`)
* **Màn hình chọn Slot**: Đồng bộ tên và màu sắc nhân vật theo thời gian thực từ Host, khóa các slot đã có người chọn.
* **Giao diện Gamepad**:
  * **Analog Joystick ảo** bên trái hỗ trợ đa điểm chạm (`left`, `right`, `down`).
  * **3 nút hành động** bên phải (`Nhảy`, `Bắn`, `Bom`).
  * **Live HUD Pill** ở trên cùng hiển thị trực tiếp **Mạng, Tên súng, Đạn & Bom** đồng bộ từ Host.
  * **Chế độ tùy chỉnh (`⚙️ Bố cục`)**: Cho phép kéo thả vị trí và phóng to/thu nhỏ từng cụm nút (`0.6x – 2.2x`), lưu vào `localStorage` (`gunMayhemLayout`).

---

## 4. Logic Gameplay, Vật lý, Đồ họa & AI

### 4.1. Vòng lặp & Camera (`js/main.js`)
* Chạy vòng lặp **fixed-timestep 35 FPS** khớp hoàn toàn với tốc độ khung hình gốc của SWF trên sân khấu `900×600`.
* Camera tự động pan/follow mượt theo vị trí trung bình của các người chơi đang sống và rung màn hình (`shaketime`) khi có vụ nổ hoặc hạ gục.

### 4.2. Đồ họa ghép bộ phận (`js/renderer.js` & `js/assets.js`)
* Nhân vật được ghép động theo đúng thứ tự lớp và tọa độ gốc của SWF:
  `hand2` → `leg2` → `jetpack` → `body` → `shirt` → `head` → `eyes` → `hat` → `leg1` → `gun` → `hand1` → `shield`.
* Hỗ trợ chuyển động chân khi chạy/nhảy, độ giật súng (`blowback`), vệt tốc độ (`Speed Boost`), thời tiết mưa/tuyết ở các map đặc thù và mũi tên chỉ hướng khi nhân vật bị văng ra ngoài khung hình.

### 4.3. Vật lý Platformer & Knockback (`js/entities.js`)
* **One-way Platforms**: Kiểm tra va chạm theo sub-step khi rơi xuống; hỗ trợ nhảy xuyên từ dưới lên và bấm xuống để rơi xuyên tầng (`freepass`).
* **Di chuyển & Nhảy**: Nhảy 2 bước (Double Jump), nhảy 3 bước (Triple Jump Perk), Jetpack, ma sát không khí/mặt đất và trọng lượng súng (`weight`).
* **Vũ khí & Knockback**: Sát thương đẩy văng (`firepower`), độ giật lùi (`recoil`), nạp đạn súng lục, đạn shotgun tỏa chùm, tia De-materializer, giữ nút `Bom` để căn lực ném thuốc nổ (`Grenade`), bom vịt (`DuckyBomb`), súng phóng lựu (`LauncherGrenade`) và tự nổ (`Suicide Explosive`).

### 4.4. Powerups, Crates & Chế độ chơi
* **7 Powerups** với đồ họa tách lớp chuẩn SWF (`DefineSprite_851` + bóng đổ + hào quang + cột sáng):
  1. **Extra Life (1-UP)**: +1 mạng sống.
  2. **Invisibility**: Tàng hình tạm thời.
  3. **Shield**: Quả cầu khiên (`DefineSprite_822`) giảm 67% lực đẩy, có hoạt ảnh bung khiên (`2..22`), nảy đàn hồi khi trúng đạn (`23..30`) và nhấp nháy trước khi tắt.
  4. **Jet Pack**: Cấp nhiên liệu bay phản lực.
  5. **Double Team**: Triệu hồi 1 AI Clone hỗ trợ cùng phe.
  6. **Speed Boost**: Tăng gấp đôi tốc độ chạy kèm vệt bóng mờ.
  7. **Minimize**: Thu nhỏ kích thước nhân vật và hitbox.
* **7 Chế độ chơi**:
  * *Last Man Standing*, *1 Hit 1 Kill*, *Last Team Standing*, *Gun Game* (15 cấp súng), *Gun Game Reversed* (14 cấp súng), *Jetpacks*, và *Survival* (đánh robot theo wave + quay thưởng *Mystery Box*).

### 4.5. AI Bot (`js/ai.js`)
* Quét mục tiêu gần nhất mỗi 40 frame (ưu tiên nhặt `1-UP` / `Jetpack` / hòm súng khi xuất hiện).
* Dùng 3 điểm dò sàn (`land1`, `land2`, `noland`) để tránh rơi vực, tự nhảy leo tầng khi mục tiêu ở trên cao, quay về giữa map khi bị đẩy sát mép, nhảy né đạn bay tới và chạy tránh thuốc nổ sắp phát nổ.

---

## 5. Hướng dẫn chạy & Chơi Multiplayer

1. Cài đặt **Node.js** (nếu chưa có).
2. Khởi động server bằng cách nhấp đúp vào **`start.bat`** hoặc chạy lệnh trong thư mục dự án:
   ```bash
   node server.js
   ```
3. Mở trình duyệt trên máy tính tại `http://localhost:3000`.
4. **Chơi với tay cầm điện thoại**:
   * Truy cập bằng địa chỉ **IP LAN** của máy tính (ví dụ `http://192.168.1.x:3000`) hoặc deploy tĩnh lên GitHub Pages.
   * Quét mã QR ở góc trên bên trái màn hình bằng camera điện thoại để kết nối tối đa 4 tay cầm.

### Phím điều khiển mặc định trên PC
* **Player 1**: Phím Mũi tên (Di chuyển / Nhảy / Rơi sàn) — `Z` (Bắn) — `X` (Ném Bom)
* **Player 2**: `W A S D` — `T` (Bắn) — `Y` (Ném Bom)
* **Player 3**: `I J K L` — `P` (Bắn) — `O` (Ném Bom)
* **Player 4**: `Numpad 8/4/5/6` — `Numpad 1` (Bắn) — `Numpad 2` (Ném Bom)
