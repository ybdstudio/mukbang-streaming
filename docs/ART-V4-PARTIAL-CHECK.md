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

---

# Art V4 core (Codex, 05/11/2026): tích hợp

Nguồn: `mukbang-art-v4-core-20261105.zip`, lưu nguyên trong `art-src/art-v4-core-20261105/`. Đợt này giao 114 file mới, cộng 12 file khuôn đã giao từ trước. Không có file nào bị thiếu so với danh sách của Codex. Riêng `CORE-PENDING.txt` đã cũ: mọi file nó liệt kê đều có trong ZIP.

## Đã vào game
- **Gói main** `assets/cook/` (≈ 416 KB):
  - 51 icon trong khay chọn: vị, nước dùng, topping, topping ramen, topping boba, deco, khuôn;
  - 22 sprite topping;
  - 7 lớp rắc;
  - 7 dụng cụ × 2 frame, kèm lớp tô màu cho bình rót.
- **Subpackage `art4/`** (0,56 MB, khai báo trong `game.json`): khuôn 600 px, 24 lớp thạch (fill / detail, trong khuôn / đã lật ra), nền bếp. Gói được tải ngay khi bắt đầu stream. Trong lúc chờ tải thì game vẽ vector.
  - Bản web nhúng luôn `art4/`.
  - App Android không có subpackage, nên game kiểm tra `'loadSubpackage' in tt` để không bị hs-check báo lỗi.
- **Lớp thạch:** fill màu xám được nhân màu theo vị (multiply, giữ alpha), rồi đặt lớp detail không tô màu lên trên. Pudding có thêm lớp caramel ở đỉnh. Thạch đã lật ra được đặt đứng trên đĩa.
- **Bố cục bếp:**
  - Món đặt ở 53% chiều cao màn để đứng trên mặt bàn (mặt bàn ở 60%).
  - Bình rót được lật ngang để vòi hướng vào món; dòng chảy bắt đầu từ vòi.
  - Dụng cụ rung nhẹ khi đang chạy.
- **Kích thước gói:** main 3,50 MB / 4 MB, art4 0,56 MB / 4 MB.

## Vẫn vẽ vector (chưa có art)
- Đồ chứa của cupcake, boba, ramen, parfait, donut, bingsu.
- Icon chọn ly (`cup`) và khuôn donut (`shape`).
- Đĩa phục vụ, UI bếp (khay, thẻ, nút ✓, banner PERFECT).

---

# Art V4 next (Codex, 05/11/2026): tích hợp

Nguồn: `mukbang-art-v4-next-20261105.zip`, lưu trong `art-src/art-v4-next-20261105/`. Codex giao đủ 67/67 file theo `CHECKLIST-V4-NEXT.csv`, không có lỗi kỹ thuật nào trong qa.json.

## Đã vào game
- **Đồ chứa của 6 công thức** (subpackage `art4`): cupcake, boba, ramen, parfait, donut (4 hình), bingsu. Cách ghép từng loại lớp:
  - Lớp fill được nhân màu: vị, nước dùng hoặc màu ly.
  - Trà boba và các tầng parfait hiện dần từ đáy lên theo lượng rót.
  - Kem cupcake mọc dần lên.
  - Glaze donut và siro bingsu hiện mờ dần vào.
  - Bột sống chuyển sang bánh chín sau bước lò hoặc lửa.
  - Mì xuất hiện sau bước nấu. Hơi nước nhấp nháy.
  - Topping và hạt rắc được đặt theo bề mặt của từng sprite.
- **Icon khay chọn:** 5 màu ly và 4 hình donut.
- **UI bếp:** chấm tiến độ, thẻ yêu cầu, khay, ô chọn (thường / đang chọn / RARE), nhãn ▶ RARE, nút ✓, banner PERFECT/YUMMY, nút MAKE (9-slice, chữ do game viết).
- **Stream:** đĩa phục vụ. Đĩa đã ăn hết thì chuyển sang đĩa còn vụn. Món trên stream không vẽ thêm đĩa riêng của nó nữa.
- **Kích thước gói:** main 3,67 MB / 4 MB; art4 1,03 MB / 4 MB.

## Ghi chú cho Codex
- `pip_on.png` hơi mờ ở kích thước gốc 40 px. Nên xuất lại từ nguồn lớn hơn nếu cần sắc nét.
- Gói main chỉ còn khoảng 0,33 MB. Các đợt sau nên đưa phần lớn vào subpackage.
