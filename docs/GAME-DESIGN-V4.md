# Mukbang Bang — Game Design V4: nấu trước, stream sau (03/11/2026)

V4 thay vòng chơi chính của V3 (mở gói đồ ăn → ăn) bằng vòng chơi trong hai video tham khảo (IMG_3056, IMG_3057):
**viewer yêu cầu món → tự nấu theo từng bước chọn → PERFECT! → lên stream ăn 3 phần → MISSION COMPLETE.**
Chợ / giao hàng / buffet (đồ ăn đóng gói) vẫn còn, là hoạt động phụ.

## 1. Video tham khảo cho thấy gì

- Mỗi màn bắt đầu bằng **yêu cầu của viewer**: một tấm thẻ có hình món và tên (vd. "Blueberry Jelly + Cherry").
- Phòng bếp là **một màn hình**: hàng chấm tiến độ ở trên, món ăn ở giữa, **khay 4 lựa chọn** ở dưới, nút ✓ màu xanh.
- Các bước nấu là thao tác ngắn: chọn khuôn → chọn vị → **giữ để rót** → giữ quạt cho đông → chạm để lật khuôn → chọn topping → chạm để đặt topping → chọn đồ trang trí → **chà để rắc**.
- Xong thì hiện banner **PERFECT!**, món được chia ra **3 đĩa**, streamer ăn trên live (mỗi phần 3 miếng), số viewer tăng, rồi **MISSION COMPLETE** kèm thưởng.
- Quảng cáo: một ô chọn có nhãn ▶ (nguyên liệu hiếm) trong khay, quà của fan giữa các miếng ăn, quảng cáo xen kẽ ở nút NEXT.

## 2. Vòng chơi (mỗi màn khoảng 60–80 giây)

| # | Màn hình | Người chơi làm gì | Ghi chú |
|---|---|---|---|
| 1 | Stream: VIEWER REQUEST | chạm MAKE JELLY (hoặc món khác) | màn 1 có gợi ý "TAP!"; người chơi mới vào thẳng stream 1 |
| 2 | Bếp: bước chọn | chạm 1 trong 4 ô rồi chạm ✓ | trong khay luôn có món viewer yêu cầu |
| 3 | Bếp: rót / dụng cụ | giữ ngón tay (~2 giây) | rót, quạt, lửa, lò, máy trộn, bình lắc, máy bào đá |
| 4 | Bếp: lật / đặt / rắc | chạm, chạm N lần, chà | |
| 5 | PERFECT! / YUMMY! | — | PERFECT nếu vị (hoặc nước dùng) và topping đúng yêu cầu; chọn sai thì vẫn phục vụ, không có màn thua |
| 6 | Stream: 3 đĩa | chạm hoặc kéo đĩa vào miệng, mỗi đĩa 3 miếng | tim / quà / superchat như V3 |
| 7 | MISSION COMPLETE | — | thưởng = reward của màn × 1.5 nếu PERFECT |
| 8 | Kết quả | NEXT / bonus ad / về nhà | sao, xu, mục mở khóa |

Lưu và tiếp tục (run_json v4): đóng game khi đang nấu thì lần sau quay về yêu cầu (nấu lại). Đã phục vụ thì giữ món và số phần đã ăn. Đóng giữa miếng ăn thì không trả xu hai lần. Run cũ từ V1/V2 bị bỏ an toàn; level và xu vẫn giữ.

## 3. Công thức (src/recipes.js)

8 món: jelly, pudding, cupcake, boba, ramen, parfait, donut, bingsu.
Loại bước: `pick(slot)`, `pour`, `hold(tool)`, `flip`, `place(n)`, `shake`.
Các slot lựa chọn: mold, flavor, broth, topping, ramen_top, boba_top, deco, cup, shape. Mỗi lựa chọn có level mở khóa riêng, nên màn nào cũng có thứ mới ("NEW FLAVOUR: BLUEBERRY"…).

Ví dụ Jelly: chọn khuôn → chọn vị → rót → làm lạnh (quạt) → lật → chọn topping → đặt ×3 → chọn đồ trang trí → rắc.

## 4. Level (src/levels.js): 40 màn, 5 chương × 8 màn

- Đủ 8 món trước màn 15. Từ màn 25 trở đi, mỗi màn mở thêm một lựa chọn mới.
- Hoạt động phụ: Chợ mở ở màn 3, Giao hàng ở màn 7, Buffet ở màn 11. Mỗi hoạt động là một stream thưởng với một món đóng gói, không làm tăng level.
- Tủ đồ mở ở màn 6; quà trang phục ở các màn 13/16/19/22/24/27/29/31/34/36/38/40. Streamer Kiko mở ở màn 10, Momo ở màn 20.
- Mục tiêu viewer tăng dần từ 500 lên khoảng 1 triệu. Xu mỗi miếng = 6 + 2n. Thưởng mission = 100 + 20n.

## 5. Quảng cáo (8 vị trí, cooldown 30 s trên dashboard)

| Vị trí | Loại | Khi nào | Phần thưởng |
|---|---|---|---|
| stream_end | interstitial | chạm NEXT, từ stream thứ 4 | không |
| bonus_coins | rewarded | màn kết quả | dashboard (300 xu) |
| free_coins | rewarded | nút "+" cạnh số xu | dashboard (200) |
| fan_gift | rewarded | giữa các đĩa (không hiện khi đang nhai), 1 lần mỗi stream | dashboard (300) |
| **rare_choice** (mới) | rewarded | ô ▶ RARE trong khay chọn, 1 lần mỗi món, từ stream thứ 4 | không có giá trị: dùng nguyên liệu hiếm (của level sau), được tính như đúng yêu cầu → PERFECT |
| viral_boost | rewarded | gói đồ ăn còn niêm phong (hoạt động phụ) | không (+25% viewer) |
| surprise_food | rewarded | màn nhà | không (stream thưởng món hiếm) |
| fashion_reward | rewarded | tủ đồ | không (1 món đồ) |

Game không bao giờ tự quyết giá trị phần thưởng. Mọi showAd đều chạy trong lúc chạm. Mỗi lần quảng cáo được đếm req / imp / done / grant / fail. Kết quả null không tính là impression.

## 6. Kết quả mô phỏng (tools/sim-test.mjs, 40 màn, các thao tác chạm thật)

Giả định: tỉ lệ có quảng cáo 90%, mỗi quảng cáo 20 giây, mỗi persona có thời gian suy nghĩ và tỉ lệ tự chọn xem quảng cáo riêng (ghi trong source).
"playtime" là thời gian chơi không tính quảng cáo.

| persona | tổng (cả ads) | playtime | imps | imps / 5 phút (trung bình, min–max) |
|---|---|---|---|---|
| beginner | 75′ | 48′ | 71 | 4.9 (3–7) |
| average | 74′ | 41′ | 85 | 5.9 (4–8) |
| skilled | 63′ | 34′ | 74 | 6.0 (4–8) |
| adUser | 109′ | 49′ | 161 | 7.4 (4–9) |
| noAds | 64′ | 46′ | 39 | 3.1 (1–5) |

- **Playtime ~40 phút: đạt** (average 41′, beginner 48′).
- **KPI 8 imps / 5 phút: chưa đạt** với người chơi trung bình (5.9). Nút rare_choice đã nâng con số từ 5.5 lên 5.9. Interstitial ở NEXT gần như đã ra mỗi màn: average 48 lần request trong khoảng 51 stream.
- Muốn đạt 8 với người chơi trung bình, cần thêm khoảng 2 quảng cáo mỗi màn. Lựa chọn thực tế nhất là thêm **interstitial thứ hai ở bước chuyển PERFECT → stream**. Cách này tốn retention, nên cần chủ dự án quyết.

## 7. File

- Mới: `src/recipes.js` (dữ liệu và vẽ vector), `src/cook.js` (màn bếp).
- Sửa: `src/levels.js` (40 màn V4), `src/stream.js` (yêu cầu / 3 đĩa / mission / quà fan), `src/game.js`, `game.js` gốc (wrapper fan_gift và rare_choice), `mukbang-bang.hs-dashboard.json` (8 vị trí).
- Art còn thiếu: sprite cho lựa chọn (khuôn, chai vị, topping, đồ trang trí) và dụng cụ (quạt, lửa, lò…). Hiện đang vẽ bằng vector fallback trong recipes.js / cook.js.
