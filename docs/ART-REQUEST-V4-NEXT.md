# Mukbang Bang — yêu cầu art V4 đợt tiếp (cho Codex)

Ngày 05/11/2026. Đợt core (chai vị, topping, deco, dụng cụ, thạch, nền bếp) **đã vào game và chạy tốt**. Xem `refs/cook-v4-ingame.png`.

Đợt này hoàn thiện phần bếp còn đang vẽ tạm bằng vector:
- đồ chứa của 6 công thức còn lại;
- icon chọn ly và khuôn donut;
- UI bếp;
- đĩa phục vụ.

Không làm nhân vật, đồ Wardrobe hay concept phòng. Các phần đó vẫn **hoãn** theo chủ dự án.

Phong cách giữ đúng như đợt core đã duyệt: viền nâu ấm, pastel, bóng mềm, có padding. Export giống đợt core: PNG palette có alpha, không dither, kèm `manifest.*.fragment.json` ghi kích thước, neo, SHA256, package; kèm registration JSON và bảng preview.

Danh sách đường dẫn đầy đủ: `CHECKLIST-V4-NEXT.csv` (**67 file**).

---

## 0. Cách game ghép lớp (đọc trước)

Game dựng món ăn theo đúng cách đã dùng cho thạch (`src/cookart.js`):

1. **Canvas chung 600×600, neo [300, 300].** Mọi lớp của một công thức nằm trên **cùng canvas và cùng vị trí**. Game chồng chúng lên nhau mà không căn lại.
2. **Lớp `_fill`:** vẽ **xám trung tính**, không ám màu, vẫn giữ đủ sáng tối. Game nhân (multiply) màu người chơi chọn vào lớp này: vị, nước dùng, hoặc màu ly. Vùng sáng nhất khoảng 235/255, bóng tối nhất khoảng 120/255.
3. **Lớp `_detail`:** lớp không tô màu, đặt trên `_fill`. Gồm viền, highlight và bóng trong, phần thân bán trong suốt. Làm giống `jelly_*_detail` đã giao: tâm alpha 0, alpha trung bình phần thân khoảng 40–65.
4. **Khung đặt món:** món nằm trong khung **x 110–490, y 120–480** của canvas. **Điểm chạm bàn (đáy) ở y ≈ 470**, vì game đặt đáy món lên mặt bàn bếp. Trên stream, món cũng được thu nhỏ đặt lên đĩa theo cùng điểm này.
5. **Topping và rắc** dùng lại sprite đợt core (`top_*`, `deco_*`). Không vẽ topping vào đồ chứa. Chừa mặt trên (kem, bọt, mặt nước) đủ phẳng để topping đặt lên trông tự nhiên.
6. **Lớp lộ dần (`reveal`)**, ghi trong bảng dưới: game cắt theo chiều dọc, từ đáy lên, theo tiến độ rót. Lớp này phải vẽ ở trạng thái **đầy**.

`refs/placeholders-vector.png` là hình vector hiện tại của 6 món, hàng trên ở giữa quá trình nấu và hàng dưới khi xong. Dùng hình đó để hiểu **bố cục và các trạng thái**, không phải để bắt chước nét vẽ.

---

## 1. Đồ chứa 6 công thức — `art4/cook/` (ưu tiên 1, subpackage)

Các bước nấu đã chạy trong game được ghi trong ngoặc. Mỗi file 600×600.

### Cupcake (chọn ly → nướng trong lò → chọn vị → rót kem → topping → rắc)
| file | lớp | ghi chú |
|---|---|---|
| `cupcake_liner_fill.png` | fill, tô màu theo **ly** | cốc giấy gân dọc |
| `cupcake_liner_detail.png` | detail | viền và gân |
| `cupcake_batter.png` | màu thật | bột chưa nướng, phẳng, nằm trong cốc |
| `cupcake_base.png` | màu thật | bánh đã nướng, phồng tròn vàng nâu |
| `cupcake_cream_fill.png` | fill, tô màu theo **vị** | kem xoáy 3 tầng trên bánh; game cho kem hiện dần từ nhỏ tới đủ khi rót |
| `cupcake_cream_detail.png` | detail | viền và highlight kem |

### Boba (chọn ly → thả topping vào đáy → chọn vị → rót trà → lắc → rắc kem)
| file | lớp | ghi chú |
|---|---|---|
| `boba_cup_back.png` | màu thật | thành sau và đáy ly nhựa trong (vẽ phía sau trà) |
| `boba_tea_fill.png` | fill, tô màu theo **vị**, **reveal** | trà đầy ly |
| `boba_cup_front.png` | màu thật, bán trong | thành trước, highlight kính, nắp vòm và ống hút |
| `boba_band_fill.png` | fill, tô màu theo **ly** | đai và nhãn quanh thân ly |
| `boba_band_detail.png` | detail | |
| `boba_foam.png` | màu thật | lớp kem sữa trên mặt; game cho hiện dần ở bước rắc |

Trân châu ở đáy là `top_pearls` / `top_jelly_cubes`… đã có, game rải chúng giữa `back` và `tea`.

### Ramen (chọn bát → chọn nước dùng → rót → nấu trên lửa → topping → rắc)
| file | lớp | ghi chú |
|---|---|---|
| `ramen_bowl_fill.png` | fill, tô màu theo **bát** | bát sâu |
| `ramen_bowl_detail.png` | detail | viền, hoa văn nhỏ ở vành |
| `ramen_broth_fill.png` | fill, tô màu theo **nước dùng** | mặt nước dùng hình elip trong miệng bát, có váng mỡ nhẹ |
| `ramen_noodles.png` | màu thật | mì vàng xoắn trong nước; hiện sau bước nấu |
| `ramen_chopsticks.png` | màu thật | đũa gỗ gác chéo trên vành phải |
| `ramen_steam.png` | màu thật, bán trong | 3 sợi hơi nước; game cho nhấp nháy khi nóng |

### Parfait (chọn vị → rót các lớp → đánh kem → topping → rắc)
| file | lớp | ghi chú |
|---|---|---|
| `parfait_glass_back.png` | màu thật | ly chân cao, thành sau và chân ly |
| `parfait_layers_fill.png` | fill, tô màu theo **vị**, **reveal** | 2 lớp thạch hoặc sốt xen giữa (vùng xám) |
| `parfait_layers_cream.png` | màu thật, **reveal** | 2 lớp kem trắng xen kẽ; cùng chiều cao và cách reveal với `layers_fill` |
| `parfait_cream_top.png` | màu thật | chóp kem bông trên miệng ly, hiện sau bước đánh kem |
| `parfait_glass_front.png` | màu thật, bán trong | thành trước và highlight |

### Donut (chọn hình → chiên trên lửa → chọn vị → rót glaze → topping → rắc)
Mỗi hình gồm 4 file. Các hình có id: `ring`, `heart_d`, `star_d`, `bear`.

| file | lớp | ghi chú |
|---|---|---|
| `donut_<shape>_dough.png` | màu thật | bột sống nhạt màu |
| `donut_<shape>.png` | màu thật | bánh đã chiên vàng nâu |
| `donut_<shape>_glaze_fill.png` | fill, tô màu theo **vị** | lớp glaze phủ mặt trên, mép chảy tự nhiên; game cho hiện dần |
| `donut_<shape>_glaze_detail.png` | detail | |

Thêm `donut_plate.png`: đĩa trắng tròn phẳng nằm dưới donut, cùng canvas, đáy ở y ≈ 470.

### Bingsu (chọn bát → bào đá → chọn vị → rót siro → topping → rắc)
| file | lớp | ghi chú |
|---|---|---|
| `bingsu_bowl_fill.png` | fill, tô màu theo **bát** | bát loe |
| `bingsu_bowl_detail.png` | detail | |
| `bingsu_snow.png` | màu thật | núi đá bào trắng xanh mịn; game cho mọc dần ở bước bào |
| `bingsu_syrup_fill.png` | fill, tô màu theo **vị** | siro chảy từ đỉnh núi xuống, có vệt; game cho hiện dần |
| `bingsu_syrup_detail.png` | detail | highlight của siro |

---

## 2. Icon khay chọn — `assets/cook/` (ưu tiên 1, gói main, 160×160, neo [80, 80])

Làm giống bộ `opt_*` đã giao: một vật đứng một mình, có padding, nhìn rõ ở 72 px.
- `opt_cup_pink`, `opt_cup_mint_c`, `opt_cup_lavender`, `opt_cup_lemon_c`, `opt_cup_sky`:
  - Một ly/bát trung tính, mang màu đúng của id: pink `#ffc2d6`, mint `#bff0dd`, lavender `#ddd0ff`, lemon `#fff0a8`, sky `#c8e8ff`.
  - Slot này dùng chung cho cốc cupcake, ly boba, bát ramen và bát bingsu, nên chỉ cần **một kiểu dáng** (ví dụ cái bát nhỏ có vành).
  - **Id phải đúng như trên** (`mint_c`, `lemon_c`), vì game đọc theo id.
- `opt_shape_ring`, `opt_shape_heart_d`, `opt_shape_star_d`, `opt_shape_bear`: donut đã chiên (chưa có glaze) theo từng hình.

---

## 3. UI bếp — `assets/cook/` (ưu tiên 2, gói main)

| file | kích thước | ghi chú |
|---|---|---|
| `tray.png` | 520×160, 9-slice [40, 40, 440, 80] | khay trắng mờ bo tròn chứa các ô chọn |
| `card.png` | 220×224, 9-slice [40, 40, 140, 144] | ô chọn trắng viền hồng |
| `card_selected.png` | 220×224, cùng 9-slice | viền xanh lá dày |
| `card_rare.png` | 220×224, cùng 9-slice | nền kem vàng, viền vàng, ngôi sao góc phải trên |
| `badge_rare.png` | 160×52 | nhãn xanh "▶ RARE" (có chữ) |
| `ok.png` | 136×136 | nút ✓ xanh lá tròn |
| `pip_on.png` | 40×40 | chấm tiến độ đã xong (tim hồng), đi cặp với `pip_off` đã có |
| `banner_perfect.png`, `banner_yummy.png` | 680×176 | banner chữ PERFECT! và YUMMY! |
| `request_card.png` | 660×116, 9-slice [40, 40, 580, 36] | thẻ "VIEWER WANTS" trên đầu màn bếp (chữ do game viết) |
| `btn_make.png` | 9-slice như `ui/btn_start.png` V3 | nút vàng MAKE JELLY…, không có chữ |

Ghi trong manifest các thông số 9-slice theo dạng `slices` như V3.

---

## 4. Đĩa phục vụ trên stream — `assets/stream/` (ưu tiên 3, gói main)

- `serve_plate.png` 400×160, neo [200, 80]: đĩa trắng viền xanh nhạt nhìn chéo. Game đặt 3 đĩa trên bàn stream, mỗi đĩa một phần món.
- `serve_plate_empty_crumbs.png` 400×160: cùng đĩa nhưng còn vụn và vệt sốt, dùng sau khi phần đó đã ăn xong.

---

## 5. Ngân sách và gói

- Gói main còn khoảng **0,45 MB**. Mục §2–§4 (icon, UI, đĩa) đặt trong main, ước tính dưới 0,25 MB.
- Mục §1 (đồ chứa) đặt trong subpackage `art4`, hiện 0,56 MB / 4 MB. Mục tiêu: ≤ 25 KB mỗi lớp 600 px, giống mức của lớp thạch.
- Giao thêm 1 ảnh preview ghép cho mỗi công thức, gồm từng trạng thái theo bước, đã tô bằng 2 màu thử (một vị đậm, một vị nhạt), giống `core-jelly-composite`.

## 6. Thứ tự giao

1. Ramen và boba: hai công thức dùng nhiều nhất sau thạch. Giao kèm `opt_cup_*`.
2. Cupcake, bingsu, parfait, donut và `opt_shape_*`.
3. UI bếp và đĩa phục vụ.

Không cần dừng chờ duyệt giữa các nhóm: phong cách đã được duyệt. Chỉ dừng khi có điểm kỹ thuật chưa rõ.
