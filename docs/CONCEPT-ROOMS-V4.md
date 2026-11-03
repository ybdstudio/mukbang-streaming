# Mukbang Bang — 6 concept phòng livestream + thực đơn (giai đoạn chữ)

Ngày 03/11/2026. Đây là phần mở rộng sau 40 level V4. Mỗi concept là **một cặp**: một phòng stream (thay `home_room`) và một thực đơn 4 món nấu theo hệ thống bước của V4.

Các bước sẵn có: `pick`, `pour`, `hold` (fan / fire / oven / mixer / shaker / shaver), `flip`, `place`, `shake`.

Mọi phòng theo đúng chuẩn của `home_room`:
- 1080×2400, có 1 vùng alpha thật (cửa sổ, bể kính, màn hình…) để game ghép cảnh động phía sau, toạ độ ghi trong manifest `windowAlphaBounds`.
- 48% dưới cùng để trống cho bàn.
- Bên trái trống cho đạo cụ quay, bên phải trống cho thẻ LIVE (xem ART-V3-STAGE1-CHECK §2).

Tiêu chí chấm:
- (a) dùng lại được bước và dụng cụ đã có (tốn ít code);
- (b) làm thực đơn đa dạng hơn: hiện 8 công thức thì 7 là đồ ngọt, chỉ ramen là món mặn;
- (c) có khoảnh khắc ASMR hoặc TikTok rõ;
- (d) lượng art cần vẽ;
- (e) khác hẳn phòng hiện tại (pastel lavender).

---

## 1. Night Market Stall — Quầy chợ đêm

- **Phòng:** quầy xe đẩy gỗ dưới mái bạt sọc đỏ trắng, đèn lồng giấy và dây đèn tròn vàng, bảng hiệu viết tay tên hư cấu ("YUMYUM STALL"). Vùng alpha là khoảng trời đêm và con phố sau quầy: người đi bộ mờ, khói bay lên, các quầy khác lấp lánh. Có thể đổi giữa trời mưa và trời sao. Bảng màu đỏ đèn lồng, cam ấm và xanh đêm.
- **Thực đơn:**
  - **Takoyaki**: pick nhân → pour bột vào khay → hold fire → **flip** (lật viên) → place sốt → shake rắc cá bào.
  - **Tteokbokki**: pick độ cay → pour sốt → hold fire → place bánh cá và trứng → shake mè.
  - **Egg Waffle**: pour bột → hold fire → flip khuôn → pick kem → place topping.
  - **Xiên nướng**: pick loại xiên → place lên vỉ → hold fire → shake gia vị.
- **Khoảnh khắc:** tiếng xèo xèo và khói khi lật takoyaki. Kéo phô mai tteokbokki dãn dài trên stream.
- **Chấm:**
  - (a) cao: chỉ cần dụng cụ mới là khay takoyaki và vỉ nướng.
  - (b) rất cao: thêm 3–4 món mặn.
  - (c) cao.
  - (d) trung bình.
  - (e) cao.

## 2. Sakura Tea House — Trà thất hoa anh đào

- **Phòng:** chiếu tatami, bàn thấp, vách shoji mở ra vườn hoa anh đào (vùng alpha), có cánh hoa bay qua. Ánh sáng chiều hồng nhạt.
- **Thực đơn:**
  - **Dango 3 màu**: pick màu → place 3 viên → hold fire nướng nhẹ → pour sốt.
  - **Matcha latte**: pour sữa → **shake** (đánh matcha bằng chổi tre).
  - **Taiyaki**: pour bột → hold fire → flip → pick nhân.
  - **Wagashi hoa**: pick khuôn → place.
- **Khoảnh khắc:** đánh bọt matcha, cắn taiyaki giòn.
- **Chấm:**
  - (a) rất cao.
  - (b) trung bình, vẫn thiên về đồ ngọt.
  - (c) trung bình.
  - (d) thấp, vì cảnh sakura V1 đã có.
  - (e) **thấp**: trùng chương có view sakura và tông hồng hiện tại.

## 3. Aquarium Café — Quán cà phê thủy cung

- **Phòng:** cả bức tường là bể kính lớn (vùng alpha). Phía sau có cá, sứa, rùa bơi qua dạng sprite lặp, tia nắng rọi từ trên xuống, kèm bong bóng. Ghế vỏ sò, đèn hình sứa. Bảng màu xanh ngọc và aqua, điểm hồng san hô.
- **Thực đơn:**
  - **Ocean Jelly**: thạch xanh soda có cá jelly nhỏ bên trong, dùng lại toàn bộ bước của jelly với khuôn mới là cá và vỏ sò.
  - **Seashell Madeleine**: pick khuôn vỏ sò → pour → hold oven → flip.
  - **Sushi cuộn mini**: place cơm → place nhân → hold để **cuộn** (bước mới, có thể làm biến thể của `hold`) → pick sốt.
  - **Blue Ocean Boba**: pour 2 lớp màu (biến thể của `pour`) → hold shaker → place trân châu xanh.
- **Khoảnh khắc:** đàn cá bơi ngang khi viewer tăng vọt, và finale có cá voi bơi qua.
- **Chấm:**
  - (a) cao: chỉ thêm 1 biến thể bước.
  - (b) khá: có sushi là món mặn.
  - (c) **rất cao**: cảnh động phía sau cửa sổ.
  - (d) trung bình–cao: cần sprite cá.
  - (e) **rất cao**.

## 4. Space Diner — Quán ăn trạm vũ trụ

- **Phòng:** cửa sổ tròn kiểu tàu vũ trụ (vùng alpha) nhìn ra Trái Đất, các hành tinh và sao băng. Đèn neon tím xanh, robot phục vụ nhỏ trên kệ.
- **Thực đơn:**
  - **Galaxy Donut**: glaze xoáy màu thiên hà, dùng lại toàn bộ bước của donut, thêm deco bụi sao.
  - **Planet Macaron**: pick màu hành tinh → pour → hold oven → place nhân.
  - **Nebula Soda**: pour 3 lớp → shake.
  - **Kem phi hành gia**: hold shaver (đông khô) → place.
- **Khoảnh khắc:** đồ ăn lơ lửng một chút trước khi vào miệng (không trọng lực), và sao băng xuất hiện khi PERFECT.
- **Chấm:**
  - (a) cao.
  - (b) thấp, toàn đồ ngọt.
  - (c) cao, vì món "galaxy" đang là trend trên TikTok.
  - (d) trung bình.
  - (e) cao.

## 5. Candy Lab — Xưởng kẹo

- **Phòng:** ống kẹo trong suốt chạy quanh tường, nồi khuấy sô-cô-la, băng chuyền kẹo. Vùng alpha là ô kính nhìn vào dây chuyền đang chạy. Bảng màu nhiều màu kẹo.
- **Thực đơn:**
  - **Lollipop xoắn**: pick màu → pour vào khuôn → hold fan.
  - **Bonbon sô-cô-la**: mold → pour → fan → flip, giống jelly.
  - **Kẹo bông**: hold để quay (dụng cụ mới: máy kẹo bông).
  - **Gấu gummy**: pick khuôn → pour → flip → shake đường.
- **Khoảnh khắc:** kẹo bông phồng to dần khi giữ ngón tay, và tiếng cắn gummy dai.
- **Chấm:**
  - (a) rất cao.
  - (b) thấp, toàn đồ ngọt.
  - (c) trung bình–cao.
  - (d) trung bình.
  - (e) trung bình.
  - Lưu ý: đối tượng nhỏ tuổi rõ rệt. Cần giữ phong cách không quá trẻ con.

## 6. Fire Challenge Studio — Studio thử thách cay

- **Phòng:** phòng thu đen đỏ, có bảng LED "SPICE LEVEL" (đồng hồ độ cay), ớt treo tường, bình chữa cháy để làm trò đùa. Vùng alpha là màn hình lớn phía sau, chiếu đồng hồ độ cay và lửa động.
- **Thực đơn:**
  - **Fire Noodle**: pick mức cay 1–5 → pour sốt → hold fire → place phô mai.
  - **Cánh gà cay**: place → hold fire → shake bột ớt.
  - **Lẩu mini**: pick nước dùng → place nhân → hold fire.
  - **Sữa cứu hoả**: pour → shake, đây là món "giải cay" phục vụ giữa chừng.
- **Khoảnh khắc:** mức cay càng cao thì viewer tăng càng nhanh nhưng streamer đổ mồ hôi. Dùng lại biểu cảm `spicy` (eyes_x, mouth_fire, fx_sweat, **fx_steam_ears**) đã có trong art V3. Đây là dạng nội dung mukbang kinh điển.
- **Chấm:**
  - (a) cao: biểu cảm có sẵn, cần thêm cơ chế chọn độ cay.
  - (b) rất cao.
  - (c) **rất cao**.
  - (d) thấp–trung bình.
  - (e) cao.
  - Rủi ro: tông màu tối và căng hơn phần còn lại của game.

---

## Đề xuất đưa vào bảng duyệt: **Night Market Stall** và **Aquarium Café**

**Night Market Stall:**
- Bổ sung đúng chỗ thực đơn đang yếu nhất: thêm 3–4 món mặn, trong khi hiện 7/8 công thức là đồ ngọt.
- Dùng lại gần hết bước có sẵn (flip, fire, place, shake). Chỉ cần vẽ khay takoyaki và vỉ nướng.
- Tiếng xèo xèo, khói và phô mai kéo dài là nội dung ASMR đúng chất mukbang.
- Không khí đỏ cam ban đêm tách hẳn khỏi phòng pastel lavender hiện tại.

**Aquarium Café:**
- Tận dụng tốt nhất kỹ thuật cửa sổ alpha vừa có trong `home_room`. Cả bức tường thành bể cá động phía sau streamer, nên mỗi stream trông khác đi mà không phải vẽ thêm phòng.
- Bảng màu xanh mát cân bằng với món mặn tông nóng của Night Market. Hai phòng xếp liền nhau sẽ tạo nhịp nóng → lạnh qua các chương.
- Thực đơn vẫn dùng lại khung jelly, boba và madeleine (oven + flip). Chỉ thêm một biến thể bước (cuộn sushi, rót 2 lớp).

**Vì sao không chọn các concept khác:**
- **Fire Challenge** là lựa chọn dự phòng mạnh nhất: dùng lại biểu cảm cay đã vẽ, rất hợp mukbang. Nhưng nó trùng vai "món mặn" với Night Market. Nên đưa vào Night Market dưới dạng sự kiện "SPICE LEVEL" thay vì làm phòng riêng.
- **Sakura Tea House** trùng chương có view sakura và tông hồng sẵn có.
- **Space Diner** và **Candy Lab** lại làm thực đơn ngọt thêm.

**Bảng duyệt cho 2 concept** (gợi ý Codex làm ở đợt mẫu):
- 1 phác phòng (có vùng alpha) và 1 phác cảnh động sau cửa sổ.
- 4 icon món ở trạng thái hoàn thành.
- 1 dụng cụ mới.
- 1 khung stream mẫu có streamer ngồi trong phòng, để kiểm tra chỗ cho thẻ LIVE và đạo cụ quay.
