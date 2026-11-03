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

## 5. Quảng cáo (13 vị trí, cooldown 30 s trên dashboard)

| # | Vị trí | Loại | Ở đâu / khi nào | Người chơi nhận |
|---|---|---|---|---|
| 1 | stream_end | interstitial | chạm NEXT / HOME / REPLAY ở màn kết quả, từ stream thứ 4 | — |
| 2 | **cook_step** | interstitial | chạm ✓ ở giữa công thức (từ bước 3), 1 lần mỗi món, từ stream thứ 5; tắt với No Ads | — |
| 3 | bonus_coins | rewarded | màn kết quả | xu (dashboard, 300) |
| 4 | free_coins | rewarded | nút "+" cạnh số xu | xu (dashboard, 200) |
| 5 | fan_gift | rewarded | stream: sau đĩa 1, 1 lần mỗi stream | xu (dashboard, 300) |
| 6 | rare_choice | rewarded | ô ▶ RARE trong khay chọn, 1 lần mỗi món | nguyên liệu hiếm, tính là đúng yêu cầu |
| 7 | **serve_bonus** | rewarded | sau PERFECT/YUMMY: SERVE hoặc ▶ HOT START | stream bắt đầu với +40% goal viewer |
| 8 | **extra_hype** | rewarded | stream: đĩa cuối, trước finale, 1 lần mỗi stream | +50% goal viewer → dễ đạt 2–3★ |
| 9 | **unlock_level** | rewarded | màn LEVELS: ô ▶ UNLOCK trên level khóa kế tiếp | mở level sớm (thưởng level vẫn trả 1 lần khi qua) |
| 10 | **unlock_look** | rewarded | tủ đồ: đồ quà-level (▶ UNLOCK · LV n) | nhận món đồ sớm, tự mặc |
| 11 | fashion_reward | rewarded | tủ đồ: WATCH AD: FREE NEW LOOK | 1 món đồ shop ngẫu nhiên |
| 12 | viral_boost | rewarded | gói đồ ăn còn niêm phong (hoạt động phụ) | +25% viewer |
| 13 | surprise_food | rewarded | màn nhà | stream thưởng món hiếm |

Game không bao giờ tự quyết giá trị phần thưởng: xu đến từ kết quả SDK/dashboard. Các vị trí khác chỉ thay đổi lối chơi. Mọi showAd đều chạy trong lúc chạm. Mỗi lần được đếm req / imp / done / grant / fail. Kết quả null không tính là impression.

## 6. Kết quả mô phỏng (tools/sim-test.mjs, 110 kiểm tra, 40 màn, các thao tác chạm thật)

Giả định: tỉ lệ có quảng cáo 90%, mỗi quảng cáo 20 giây, mỗi persona có tỉ lệ tự chọn xem riêng (ghi trong source). "playtime" là thời gian chơi không tính quảng cáo.

| persona | tổng (cả ads) | playtime | imps | imps / 5 phút (trung bình, min–max) |
|---|---|---|---|---|
| beginner | 90′ | 54′ | 110 | 6.3 (1–8) |
| average | 92′ | 48′ | 125 | 6.9 (4–10) |
| skilled | 83′ | 40′ | 125 | 7.6 (4–11) |
| adUser | 138′ | 54′ | 248 | 9.1 (5–12) |
| noAds | 70′ | 48′ | 50 | 3.7 (1–6) |

- Playtime ~40 phút: đạt (average 48′).
- KPI 8 imps / 5 phút: average tăng từ 5.9 lên **6.9**, skilled 7.6, adUser 9.1. Người chơi trung bình vẫn **chưa đạt 8**.
- Hai interstitial (stream_end + cook_step) chiếm khoảng 2/3 số impression. Số còn lại phụ thuộc tỉ lệ người chơi tự bấm rewarded ad.

## 7. File

- Mới: `src/recipes.js` (dữ liệu và vẽ vector), `src/cook.js` (màn bếp).
- Sửa: `src/levels.js` (40 màn V4), `src/stream.js` (yêu cầu / 3 đĩa / mission / quà fan), `src/game.js`, `game.js` gốc (wrapper cho mọi vị trí), `mukbang-bang.hs-dashboard.json` (13 vị trí).
- Art còn thiếu: sprite cho lựa chọn (khuôn, chai vị, topping, đồ trang trí) và dụng cụ (quạt, lửa, lò…). Hiện đang vẽ bằng vector fallback trong recipes.js / cook.js.
