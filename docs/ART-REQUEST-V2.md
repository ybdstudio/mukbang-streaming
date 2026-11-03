# Mukbang Bang V2 — yêu cầu art (brief cho Codex)

Ngày 03/11/2026. Đọc kèm `docs/ART-REQUEST.md` (V1: phong cách, kỹ thuật, manifest — **giữ nguyên toàn bộ quy tắc ở đó**) và `docs/GAME-DESIGN-V2.md`.
Game V2 đã chạy bằng **hình vẽ canvas tạm** cho mọi thứ dưới đây. Art mới chỉ cần đúng tên file + manifest là game tự dùng (code đã có sẵn đường nạp sprite, hình canvas giữ làm fallback).

**Nguồn sự thật cho id**: `mukbang-bang/src/catalog.js`. Không đổi id. Món nào có art thì đổi `art: false` → `art: true` trong `catalog.js` (Codex làm, hoặc báo lại để Claude làm).

---

## 0. Quy tắc chung (bổ sung cho V1)

- Cùng phong cách kawaii/chibi, viền `#5b3d3b`, pastel, PNG nền trong suốt, vẽ 2× (V1 §1–2).
- **Không sao chép** bất kỳ thương hiệu thật nào (KFC, Domino's, Grab, Baemin, Foodpanda…). Nhà hàng & app giao hàng trong game là **hư cấu**: Chicken Joy, Mamma Pizza, Seoul Street, Tokyo Box, Hot & Boil, app **YUMGO**.
- Món ăn **món đơn** canvas 256×256, căn giữa, neo [128,128], giống V1 (`assets/food/<id>_<stage>.png`, stage 0 = nguyên, mỗi stage = sau 1 miếng; **không cần frame rỗng**).
- Không chữ trong hình, trừ logo nhà hàng / chữ ngắn trên hộp.

## 1. Ngân sách & gói (quan trọng)

- Gói TikTok hiện **3,1 MB / 4 MB**. Art V2 ước tính 2,5–3,5 MB → **phải tách subpackage**.
- Đặt art V2 vào **`mukbang-bang/art2/`** (cùng cấu trúc con: `art2/food/`, `art2/bg/`, `art2/ui/`…). Claude sẽ khai báo `game.json` → `subpackages: [{ "name": "art2", "root": "art2/" }]` và nạp bằng `tt.loadSubpackage` khi tích hợp.
- **Ngoại lệ — để ở `assets/` (gói chính)** vì cần ngay trong 5 phút đầu: món của Chicken Joy (`kfc_chicken`, `cheese_burger`), 6 món phụ, trạm Hot (6 món), `home_room.png`, `restaurant_bg.jpg`, `kitchen_bg.jpg`, `mystery_box*`, `takeout_box*`. Tổng phần này ≤ 0,8 MB.
- Mục tiêu tổng art V2 ≤ 3,5 MB; nền JPG ≤ 180 KB mỗi file.
- Ghi `art2/manifest.json` (cùng định dạng V1) + cập nhật `assets/manifest.json` cho phần ở gói chính.

## 2. Món ăn mới — 53 món, 172 frame

Mỗi dòng = 1 món = `bites` file: `<id>_0.png … <id>_<bites-1>.png`. Cột "Hình gợi ý" là kiểu dáng hình canvas tạm (`art.js` → `dishVec`), Codex có thể vẽ đẹp hơn nhưng giữ cùng ý (đĩa/bát/hộp/khay/ly…). Ăn dở: phần món giảm dần, vỏ/hộp/bát còn lại.

#### delivery/chicken_joy
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `kfc_chicken` | Korean Fried Chicken | savory | 5 | box | `#e8973a` `#ffd27a` `#b5651d` |
| `cheese_burger` | Cheese Burger | savory | 4 | burger | `#e8a25a` `#ffd95e` `#7a4b2f` |

#### delivery/mamma_pizza
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `pizza` | Pepperoni Pizza | savory | 5 | pizza | `#ffcf6b` `#ff5a4a` `#d99a12` |
| `pasta` | Creamy Pasta | savory | 4 | bowl | `#fff0c2` `#ffd27a` `#e0b52a` |

#### delivery/seoul_street
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `tteokbokki` | Tteokbokki | spicy (cay 2) | 4 | bowl | `#ff4a3a` `#ffe9d6` `#c93b1d` |
| `dumplings` | Dumplings | savory | 4 | plate | `#fff4e0` `#f3dfc4` `#c9a27c` |

#### delivery/tokyo_box
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `sushi_set` | Sushi Set | cold | 5 | tray | `#ff8a65` `#ffffff` `#2f2f2f` |
| `curry_rice` | Curry Rice | spicy (cay 1) | 4 | plate | `#e8a23a` `#ffffff` `#b5651d` |

#### delivery/hot_boil
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `mini_hotpot` | Mini Hotpot | spicy (cay 2) | 5 | pot | `#ff5a3a` `#ffd27a` `#c93b1d` |
| `seafood_boil` | Seafood Boil | spicy (cay 3) | 5 | pot | `#ff7a4a` `#ffd27a` `#c93b1d` |

#### delivery/sides
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `cola` | Cola | fizzy | 2 | cup | `#7a3d2f` `#ffffff` `#ff4a5f` |
| `fries` | Fries | savory | 2 | fries | `#ffd95e` `#ff5a4a` `#e0b52a` |
| `cheese_sticks` | Cheese Sticks | savory | 2 | plate | `#ffc94d` `#fff0c2` `#d99a12` |
| `pickled_radish` | Pickled Radish | sour | 2 | bowl | `#fff9b0` `#ffffff` `#d6c21a` |
| `miso_soup` | Miso Soup | savory | 2 | bowl | `#d9b48a` `#9fd47a` `#a67a4a` |
| `mochi` | Mochi | sweet | 2 | plate | `#ffd1e3` `#b7e3a1` `#fff` |

#### buffet/hot
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `spicy_wings` | Spicy Wings | spicy (cay 2) | 3 | plate | `#ff5a3a` `#ffd27a` `#a8231a` |
| `kimchi_rice` | Kimchi Fried Rice | spicy (cay 1) | 3 | bowl | `#ff7a4a` `#fff0c2` `#c93b1d` |
| `mapo_tofu` | Mapo Tofu | spicy (cay 2) | 3 | bowl | `#ff5a3a` `#fff4e0` `#a8231a` |
| `fried_shrimp` | Fried Shrimp | savory | 3 | plate | `#ffb84d` `#ff8a65` `#d6841a` |
| `spring_rolls` | Spring Rolls | savory | 3 | plate | `#f3c58b` `#9fd47a` `#c48a4a` |
| `iced_lemon_tea` | Iced Lemon Tea | cold | 3 | cup | `#ffd95e` `#fff9d6` `#d6ad10` |

#### buffet/cold
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `salmon_nigiri` | Salmon Nigiri | cold | 3 | tray | `#ff8a65` `#ffffff` `#2f2f2f` |
| `cold_soba` | Cold Soba | cold | 3 | bowl | `#b8a88a` `#bfe9ff` `#6b5a46` |
| `tamago` | Tamago | sweet | 3 | tray | `#ffe066` `#ffffff` `#d4ac1c` |
| `seaweed_salad` | Seaweed Salad | sour | 3 | bowl | `#6fcf8e` `#ffffff` `#2f9c55` |
| `ice_jelly` | Ice Jelly | cold | 3 | cup | `#bfe9ff` `#ffffff` `#4a9fd8` |
| `melon_slice` | Melon Slice | sweet | 3 | plate | `#9fe37a` `#ffb3a1` `#5fa23d` |

#### buffet/hotpot
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `beef_slices` | Beef Slices | savory | 3 | plate | `#ff8a8a` `#ffffff` `#c94a4a` |
| `mushroom_mix` | Mushroom Mix | savory | 3 | bowl | `#d9b48a` `#f3dfc4` `#a67a4a` |
| `fish_balls` | Fish Balls | savory | 3 | skewer | `#fff4e0` `#ffd27a` `#c9a27c` |
| `corn_cob` | Corn Cob | sweet | 3 | plate | `#ffd95e` `#9fd47a` `#d4ac1c` |
| `udon_bowl` | Udon Bowl | savory | 3 | bowl | `#fff8e1` `#d9b48a` `#c9a27c` |
| `spicy_broth` | Spicy Broth | spicy (cay 2) | 3 | cup | `#ff5a3a` `#ffd27a` `#a8231a` |

#### buffet/grill
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `mini_steak` | Mini Steak | savory | 3 | plate | `#a0522d` `#9fd47a` `#6b3a1e` |
| `yakitori` | Yakitori | savory | 3 | skewer | `#c97a3a` `#9fd47a` `#7a4b2f` |
| `sausage` | Sausage | savory | 3 | skewer | `#e8735a` `#ffd95e` `#a8432d` |
| `garlic_bread` | Garlic Bread | savory | 3 | plate | `#ffd27a` `#9fd47a` `#c99b1a` |
| `grilled_squid` | Grilled Squid | spicy (cay 1) | 3 | skewer | `#ffb199` `#ff5a3a` `#c96a4a` |
| `sparkling_soda` | Sparkling Soda | fizzy | 3 | cup | `#8fd1ff` `#ffffff` `#4a9fd8` |

#### buffet/lava
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `ghost_wings` | Ghost Pepper Wings | spicy (cay 3) | 3 | plate | `#c9231a` `#ffd27a` `#7a1010` |
| `fire_noodles` | Fire Noodles | spicy (cay 3) | 3 | bowl | `#ff3a2a` `#ffd27a` `#a8231a` |
| `lava_ricecake` | Lava Rice Cake | spicy (cay 2) | 3 | skewer | `#ff4a3a` `#fff4e0` `#a8231a` |
| `chili_dumplings` | Chili Dumplings | spicy (cay 2) | 3 | plate | `#ff8a6b` `#fff4e0` `#c93b1d` |
| `volcano_curry` | Volcano Curry | spicy (cay 3) | 3 | plate | `#c94a1a` `#ffffff` `#7a2d10` |
| `milk_cooler` | Milk Cooler | cold | 3 | cup | `#ffffff` `#ffd1e3` `#c9c9c9` |

#### kitchen/rainbow_dessert
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `diy_parfait` | Rainbow Parfait | sweet | 4 | parfait | `#ff9ecf` `#9fe3c9` `#ffd95e` |

#### kitchen/party_plate
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `diy_bento` | Party Bento | savory | 5 | bento | `#ffffff` `#ffe066` `#ff7a6b` |

#### kitchen/crispy_fry
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `diy_crispy` | Crispy Tempura | savory | 4 | plate | `#ffd27a` `#fff4cf` `#d6941e` |

#### mystery/funny
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `choco_ramen` | Chocolate Ramen | sweet | 3 | bowl | `#6b4a37` `#ffd27a` `#3d2f2f` |
| `pickle_icecream` | Pickle Ice Cream | sour | 3 | cup | `#9fe37a` `#fff8ef` `#5fa23d` |
| `wasabi_cake` | Wasabi Cake | spicy (cay 2) | 3 | plate | `#b7e3a1` `#fff8ef` `#5fa23d` |

#### mystery/rare
| id | Tên | Vị | Miếng (= số frame) | Hình gợi ý | Màu c1/c2/c3 |
|---|---|---|---|---|---|
| `golden_parfait` | Golden Parfait | sweet | 3 | parfait | `#ffd95e` `#fff8ef` `#d6940e` |


Ghi chú:
- **delivery mains** đặt trong hộp/khay giao hàng (hộp giấy kraft, khay nhựa) để khác hẳn bao bì siêu thị.
- **buffet** là phần ăn nhỏ trên đĩa/bát buffet (trông như vừa gắp từ khay). Trạm Dessert dùng lại art bánh & kem siêu thị — **không vẽ lại**.
- **mystery/funny** là món "kỳ cục" vui nhộn (Chocolate Ramen, Pickle Ice Cream, Wasabi Cake) — biểu cảm hài hước trên bao bì được phép.
- **kitchen** `diy_parfait`, `diy_bento`, `diy_crispy` là thành phẩm tự nấu (trình bày kiểu "nhà làm": bát/đĩa sứ có hoạ tiết, không có nhãn thương hiệu). `diy_cake`, `diy_ramen`, `diy_boba` **dùng lại art V1** (`straw_cake`, `cheese_noodle`, `bubble_tea`) — không vẽ.

## 3. Topping DIY — `art2/ui/toppings.png` (atlas ô 96×96)

`strawberry` Strawberry #ff5a74 · `blueberry` Blueberry #5b6fe0 · `cream_swirl` Cream #fff8ef · `sprinkles` Sprinkles #ffd95e · `kiwi` Kiwi #9fe37a · `egg` Soft Egg #ffd95e · `green_onion` Green Onion #7ed37a · `cheese_slice` Cheese #ffc94d · `chili_flakes` Chili Flakes #ff4a3a · `pearls` Pearls #3d2f2f · `cream_foam` Cream Foam #fff8ef · `strawberry_jelly` Berry Jelly #ff7fa8 · `mango_jelly` Mango Jelly #ffc83d · `tamagoyaki` Tamagoyaki #ffe066 · `karaage` Karaage #d6841a · `broccoli` Broccoli #5fbf5a · `octo_sausage` Octo Sausage #ff7a6b · `lemon` Lemon #fff36b · `dip_sauce` Dip Sauce #c93b1d

Mỗi topping 1 ô, nhìn từ trên xuống, dùng để rắc/đặt lên món trong bếp và hiển thị trên món khi stream.

## 4. Bối cảnh

| File | Kích thước | Nội dung | Gói |
|---|---|---|---|
| `assets/bg/home_room.png` | 1080×2400 PNG **có ô cửa sổ trong suốt** | phòng stream của streamer: tường pastel, **cửa sổ lớn ở vùng 16–84 % ngang × 7–38 % dọc là trong suốt** (game ghép 5 nền V1 park/beach/sakura/room/city phía sau làm cảnh ngoài cửa sổ theo chương), rèm hồng, đèn dây, kệ thú bông bên trái, poster "LIVE" bên phải. Nửa dưới (từ 48 %) bị khăn bàn che → để tường/sàn đơn giản | chính |
| `assets/bg/restaurant_bg.jpg` | 1080×2400 | nhà hàng buffet ấm áp: đèn lồng treo, bảng "ALL YOU CAN EAT" (hư cấu), quầy buffet mờ phía sau, nội dung chính ở 0–50 % | chính |
| `assets/bg/kitchen_bg.jpg` | 1080×2400 | bếp nhà: tường gạch men mint, kệ lọ gia vị, mặt bàn gỗ từ 62 % xuống | chính |
| `art2/bg/doorstep.jpg` | 1080×2400 | (tuỳ chọn) cửa nhà + bậc thềm cho hoạt cảnh giao hàng | phụ |

## 5. UI & đạo cụ

| File | Kích thước | Mô tả | Gói |
|---|---|---|---|
| `assets/ui/mystery_box.png`, `mystery_box_open.png`, `mystery_box_gold.png` | 256×256 | hộp quà tím ruy băng hồng có dấu "?", bản mở nắp, bản vàng | chính |
| `assets/ui/takeout_box.png` + `takeout_lid.png` | 256×256 | hộp giấy kraft đóng (để game in màu/logo nhà hàng lên) + nắp tách rời để bật mở | chính |
| `art2/ui/restaurant_logos.png` | atlas 5 × 160×160 | logo tròn 5 nhà hàng hư cấu: Chicken Joy (gà vàng-cam), Mamma Pizza (đỏ, lát pizza), Seoul Street (hồng, bánh gạo), Tokyo Box (xanh, sushi), Hot & Boil (đỏ cam, nồi lẩu) | phụ |
| `art2/ui/yumgo_phone.png` | 1000×1900 | khung điện thoại bo tròn (viền tím than) — màn hình **trong suốt** để game vẽ menu lên | phụ |
| `art2/ui/yumgo_logo.png` | 400×120 | logo app giao hàng hư cấu YUMGO | phụ |
| `art2/ui/scooter.png` | 400×300 | xe máy giao hàng pastel + người giao (mũ bảo hiểm hồng), thùng hàng vàng, nhìn ngang, hướng sang trái | phụ |
| `art2/ui/delivery_bag.png` | 256×256 | túi giao hàng đặt trên bàn | phụ |
| `assets/ui/tongs.png` | 160×320 | kẹp gắp inox cán hồng, **2 bản**: mở / kẹp (atlas 2 ô ngang) | chính |
| `assets/ui/buffet_pan.png` | 360×260 | khay inox buffet (nhìn chếch trên), lòng khay trống để vẽ món lên | chính |
| `assets/ui/buffet_plate.png` | 900×400 | đĩa trắng lớn hình oval nhìn chếch | chính |
| `art2/ui/kitchen_tools.png` | atlas 128×128 | nồi, chảo, bát trộn, ly lắc, thìa khuấy, bình rót | phụ |
| `art2/ui/fx.png` | atlas 128×128 | lửa (3 frame), khói tai (2), bông tuyết, vòng PERFECT, huy hiệu COMBO | phụ |

## 6. Ưu tiên giao

1. **Đợt 1 (5 phút đầu, gói chính)**: `home_room`, `restaurant_bg`, `kitchen_bg`; Chicken Joy (2 món) + 6 món phụ; trạm Hot (6 món); mystery box (3); takeout box + lid; tongs, buffet_pan, buffet_plate. **Dừng chờ chủ dự án duyệt.**
2. **Đợt 2**: 8 món delivery còn lại + logo nhà hàng + YUMGO + scooter + túi.
3. **Đợt 3**: 4 trạm buffet còn lại (24 món), DIY (3 thành phẩm + topping atlas + dụng cụ), funny/rare mystery (4), fx.

## 7. Kiểm tra trước khi giao
- Đủ id/frame theo bảng §2 (script: mỗi món `bites` file).
- Kích thước, alpha, neo, manifest; tổng dung lượng gói chính ≤ 4 MB sau khi thêm đợt 1.
- Không có tên/logo thương hiệu thật.
