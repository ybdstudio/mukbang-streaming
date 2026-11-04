# Art V4 đợt tạm (Codex, 04/11/2026): kiểm tra và tích hợp

Nguồn: `mukbang-art-v4-partial-20261104.zip`, lưu nguyên trong `art-src/art-v4-partial-20261104/` (không nằm trong gói game). Đợt này có 31 file đã xuất. Còn 253 đường dẫn ghi trong `pending-assets.csv`.

## Đã đưa vào game (gói main, thêm 83 KB, gói hiện là 3,27 MB / 4 MB)
- `features/market|delivery|buffet|wardrobe.png` và `features/lock.png`: dùng trong popup COMING SOON / NEW FEATURE. Ổ khoá chồng lên icon khi ở trạng thái COMING SOON.
- `cook/opt_mold_*.png` (6 file): icon khuôn trong khay chọn của màn bếp.
- Các file trên được đăng ký trong `src/sprites.js` (`V4`, `v4draw`) và trong `assets/manifest.json` mục `v4`. Khi Codex giao thêm `cook/opt_<slot>_<id>.png`, chỉ cần thêm đường dẫn vào danh sách `V4`, khay chọn tự dùng ảnh mới. Thiếu file thì game vẫn vẽ vector như cũ.

## Chưa đưa vào game, và lý do
| Nhóm | Lý do |
|---|---|
| `cook/mold_*.png` 600 px | chưa có lớp fill (`jelly_<mold>_fill`, `_out_fill`). Nếu ghép khuôn bitmap với thạch vector thì lệch phối cảnh. Chờ fill rồi tích hợp cả bộ |
| `cook/pip_off.png` | chưa có `pip_on` V4 tương ứng (bản V3 nằm trong đợt 1, chưa tích hợp) |
| 6 `rooms/*/room.png` (2,48 MB, art4) | các phòng concept chưa có trong game. Cần chốt concept rồi mới làm cơ chế đổi phòng và subpackage `art4` |
| 6 món concept 256 px, `sakura_tea_house/view.jpg` | thuộc concept chưa chốt |

## Nhận xét chất lượng
- Feature icons và khuôn sạch, có padding, viền đúng tông. Lên màn 390 px vẫn đọc rõ.
- Món concept nét phẳng kiểu sticker, ít khối hơn món ăn `food3` của V3 (bóng, kết cấu). Nếu đặt cạnh nhau sẽ thấy lệch phong cách, nên chốt một mức chi tiết.
- Phòng: 6/6 có alpha thật và 48% dưới kín. Night Market còn thiếu dây đèn và biển YUMYUM STALL. Fire Challenge còn thiếu màn SPICE LEVEL (ô tối dưới cửa sổ đang trống).

## Ưu tiên đề xuất cho đợt sau
Trong lúc ImageGen bị giới hạn, nên ưu tiên art cho **8 công thức đang chạy trong game** (ART-REQUEST-V4 §2):
- chai vị;
- topping và deco;
- 7 dụng cụ;
- lớp fill;
- nền bếp.

Để sau: 18 món concept và 5 view của 6 phòng. Theo `CONCEPT-ROOMS-V4.md`, chỉ Night Market và Aquarium Café được đề xuất vào bảng duyệt.
