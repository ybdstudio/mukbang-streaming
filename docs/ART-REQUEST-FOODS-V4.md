# Mukbang Bang — yêu cầu art đồ ăn Delivery / Buffet / Mystery (cho Codex)

Ngày 05/11/2026. Đợt polish (miếng ăn, fx bếp, cảnh cửa sổ, soda pop, rainbow candy, pip_on) **đã vào game**.

Chủ dự án nhận xét: "nhiều hàng ở mục delivery đang vẽ bằng code tạm, như burger". Đúng vậy: ngoài 10 món food3 và 36 món siêu thị, **49 món** còn lại đang là hình vector tạm do code vẽ. Xem `refs/foods-vector-now.png` và `refs/delivery-menu-now.png`.

Danh sách đầy đủ: `CHECKLIST-FOODS-V4.csv`, gồm 304 file:
- 294 file đồ ăn (49 món × 6 trạng thái);
- 10 file gia vị ramen **còn thiếu từ đợt polish**.

Kỹ thuật như các đợt trước:
- PNG palette có alpha, không dither;
- kèm manifest fragment (kích thước, neo, package, SHA256);
- kèm 1 ảnh preview ghép cho mỗi nhóm.

---

## 0. Gia vị ramen còn thiếu (ưu tiên 0, main)

Đợt polish chưa giao §1b. Cần giao lại theo đúng spec trong `ART-REQUEST-V4-POLISH.md` §1b:
- `assets/cook/opt_ramen_deco_<id>.png` 160×160;
- `assets/cook/deco_<id>.png` 256×256.

Danh sách id: `sesame`, `chili_flakes`, `nori_flakes`, `pepper`, `fried_garlic`.

## 1. Quy cách chung, giống bộ food3 đã giao

Mẫu cần bám theo: `refs/food3-kfc_chicken-*.png`. Đó là món delivery duy nhất đã có art thật.

- Canvas **384×384**, neo [192, 192]. Món nằm giữa, có padding khoảng 16 px.
- **Đáy món (điểm chạm bàn) ở y ≈ 350.** Mọi trạng thái của cùng một món phải trùng vị trí để game chồng khung không bị nhảy.
- 6 trạng thái, tên file `<package>/food5/<id>_<state>.png`:

| state | nội dung |
|---|---|
| `sealed` | còn đóng: hộp takeout / chai (delivery), hoặc đĩa dưới nắp chuông bạc (buffet, mystery) |
| `open` | đã mở, món đầy đủ, ngon mắt |
| `p1` | đã ăn khoảng 1/3; vết cắn, vụn, chỗ trống trong hộp |
| `p2` | còn khoảng 1/3 |
| `empty` | hộp / đĩa trống, còn vụn và vệt sốt |
| `portion` | **một miếng cầm trước miệng streamer** (xem §2) |

- Hoạt cảnh mở dùng lại các strip đã có (`open_box`, `open_dome`, `open_bottle`). Không cần vẽ lại.
- Màu hộp delivery theo màu nhà hàng: Chicken Joy `#ffb84d`, Mamma Pizza `#ff7a6b`, Seoul Street `#ff8fb3`, Tokyo Box `#8fd1ff`, Hot & Boil `#ff6b4a`. In logo chữ tắt nhỏ (CJ, MP, SS, TB, HB). **Không dùng thương hiệu thật.**
- Phong cách giữ như V3 đã duyệt: viền nâu ấm, pastel, bóng mềm, đồ ăn bóng bẩy và "ngon miệng".

## 2. Miếng `portion`

Chủ dự án đã sửa lỗi "burger ăn bằng đũa". Dụng cụ phải đúng món:

- **Cầm tay, không dụng cụ:** burger, pizza, fries, cheese sticks, wings, fried shrimp, spring rolls, corn cob, garlic bread, mochi, melon slice, tamago, salmon nigiri.
  - Vẽ miếng ăn kèm vài ngón tay ở dưới.
- **Đũa:** pasta (nĩa), tteokbokki, dumplings, sushi, soba, udon, fire noodles, choco ramen, kimchi rice, mapo tofu, beef slices, mushroom, seaweed salad, pickled radish.
  - Mì phải có màu đúng món: mì vàng, soba nâu xám, udon trắng ngà.
  - Pasta dùng **nĩa**.
- **Que xiên:** yakitori, sausage, fish balls, grilled squid, lava rice cake, chili dumplings.
  - Vẽ miếng còn trên que.
- **Thìa:** curry rice, volcano curry, mini hotpot, seafood boil, miso soup, spicy broth, ice jelly, pickle ice cream, wasabi cake, golden parfait, mini steak (nĩa).
- **Đồ uống:** cola, iced lemon tea, sparkling soda, milk cooler.
  - `portion` là ly có ống hút.
  - Game cho streamer hút, không cắn.

Phía cắn hướng lên trên, phía tay / dụng cụ hướng xuống dưới.

## 3. Danh sách món

**Delivery** (`art6`, mở kiểu `box`; riêng cola mở kiểu `bottle`)

| nhà hàng | món |
|---|---|
| Chicken Joy | `cheese_burger` |
| Mamma Pizza | `pizza`, `pasta` |
| Seoul Street | `tteokbokki`, `dumplings` |
| Tokyo Box | `sushi_set`, `curry_rice` |
| Hot & Boil | `mini_hotpot`, `seafood_boil` |
| Sides | `cola`, `fries`, `cheese_sticks`, `pickled_radish`, `miso_soup`, `mochi` |

**Mystery** (`art6`, mở kiểu `dome`)

| món | ghi chú |
|---|---|
| `choco_ramen` | món "hài": mì vàng chan nước sốt chocolate |
| `pickle_icecream` | món "hài": kem xanh cắm dưa chuột muối |
| `wasabi_cake` | món "hài": bánh xanh wasabi, bốc hơi cay |
| `golden_parfait` | món hiếm: parfait vàng có lấp lánh |

**Buffet** (mở kiểu `dome`, bày trên đĩa buffet trắng)

| quầy | món | gói |
|---|---|---|
| Hot | `spicy_wings`, `kimchi_rice`, `mapo_tofu`, `fried_shrimp`, `spring_rolls`, `iced_lemon_tea` | `art7` |
| Sushi & Cold | `salmon_nigiri`, `cold_soba`, `tamago`, `seaweed_salad`, `ice_jelly`, `melon_slice` | `art7` |
| Hotpot | `beef_slices`, `mushroom_mix`, `fish_balls`, `corn_cob`, `udon_bowl`, `spicy_broth` | `art7` |
| Grill | `mini_steak`, `yakitori`, `sausage`, `garlic_bread`, `grilled_squid`, `sparkling_soda` | `art8` |
| Lava Spicy | `ghost_wings`, `fire_noodles`, `lava_ricecake`, `chili_dumplings`, `volcano_curry`, `milk_cooler` | `art8` |

Ghi chú về độ cay:
- Các món lava cay cấp 3 có hơi đỏ và ớt.
- `ghost_wings` có màu đỏ sẫm hơn `spicy_wings`.

## 4. Ngân sách

Mỗi subpackage mới (`art6`, `art7`, `art8`) phải ≤ 4 MB.

Mục tiêu dung lượng:
- ≤ 30 KB mỗi file, tức khoảng 180 KB mỗi món;
- `sealed`, `empty`, `portion` nên ≤ 20 KB.

Ước tính:

| gói | số món | dung lượng |
|---|---|---|
| `art6` | 19 | ~3,4 MB |
| `art7` | 18 | ~3,2 MB |
| `art8` | 12 | ~2,2 MB |

Gói main chỉ nhận 10 file gia vị ở §0, mục tiêu ≤ 60 KB tổng, vì main còn khoảng 0,45 MB.

## 5. Thứ tự giao

0. 10 file gia vị ramen (§0).
1. Delivery, gồm 15 món, bắt đầu bằng `cheese_burger` và `pizza` (chủ dự án chỉ đích danh burger).
2. Mystery, gồm 4 món.
3. Buffet: `art7`, rồi `art8`.

Không cần dừng chờ duyệt giữa các nhóm, vì phong cách food3 đã được duyệt. Giao từng nhóm thành từng zip riêng.
