# Foods V4 — tiến độ handoff

Tạm dừng tạo ảnh theo yêu cầu ngày 09/11/2026. Spec dev tại ../requests/20261106-foods/ART-REQUEST-FOODS-V4.md.

- Gia vị ramen 10/10 PNG, mukbang-foods-v4-ramen-seasonings-20261106.zip.
- Delivery 90/90 PNG, mukbang-foods-v4-delivery-20261108.zip.
- Mystery 24/24 PNG, mukbang-foods-v4-mystery-20261108.zip.
- Buffet art7 108/108 PNG, mukbang-foods-v4-buffet-art7-20261109.zip. Iced lemon tea portion đã bỏ đĩa lót.
- Buffet art8 44/72 PNG, mukbang-foods-v4-buffet-art8-partial-20261109.zip. Grill đủ 36 PNG. Lava Spicy còn 28 trạng thái cần sinh.
- Tổng 276/304 PNG đã xuất. PENDING.txt và PENDING-art8.txt liệt kê 28 PNG còn thiếu.

## Nguồn và prompts

-jobs-meals.json là kế hoạch294 file và prompt thực tế dự kiến, đã cập nhật p2 giữ kích thước gốc và portion pizza là lát tam giác. Đọc file này khi tiếp tục; đừng lấy biến Node mealJobs cũ. Không chạy lại plan-meals.mjs nếu chưa bảo toàn các prompt đã tinh chỉnh.
-generation-log.json giữ lịch sử thực tế; record mới còn có sources/<id>.<generation-id>.generation.json. Output builtin nằm thêm ở C:/Users/ADMIN/.codex/generated_images/01a1a3c8-43de-7ac0-a262-649140da5fb6.
-Một lần lưu pasta_portion bị timeout Node, đã tìm lại PNG gốc và lưu với record recovered. Đã nhìn và xác nhận đúng pasta trên NĨA. Toàn bộ nguồn hiện có đã lưu trong workspace.
-Mẫu style chính refs/food3-kfc_chicken-open.png; tham chiếu món open đã sinh khi làm các trạng thái khác. Phải view nguồn địa phương trước edit.
-Có thể dùng lại art hộp đóng chung cùng nhà hàng hoặc cloche che kín cho nhiều id nếu thật sự cùng hình, ghi rõ derivedFrom và không nhận là sinh ảnh mới. Nguồn hiện tại được sinh riêng bằng ImageGen, gồm các bản sửa.

## Điều đã sửa và kiểm hình

-Burger p2 đã sửa từ burger mini nguyên vẹn thành phần còn lại có vết cắn ở kích thước gốc.
-Pizza portion đã sửa từ pizza tròn mini thành một lát tam giác cầm bằng ngón tay, không dụng cụ.
-Pasta dùng nĩa; tteokbokki/dumplings dùng đũa. Đã kiểm preview-delivery.png đủ 15 món.
-Gia vị chỉ là sesame/chili/nori/pepper/fried garlic, không dùng đồ ngọt.

## Xuất và QA

-register-foods.ps1 -Group delivery: crop alpha và đăng ký ground. Có cache sourceSha256/version, lần sau chỉ xử lý nguồn đổi. Group hỗ trợ kitchen/delivery/mystery/art7/art8/all.
-Bề rộng tối đa336, cao334 cho hộp; portion cao320; ground350. Các serving-state có cùng neo, chiều rộng hộp và ground để hạn chế nhảy. Kitchen canvas160/256 căn giữa.
-export-foods.mjs exportGroup(group,maxNew=3): indexed PNG không dither, cache SHA256 của registered source. Gọi theo lô nhỏ2–3 file, không gọi tất cả ở một Node execution dài: đã từng timeout300s. Cache lưu sau từng file. Kiểm pending bằng QA, đừng coi số results một lô là toàn nhóm.
-Palette tự giảm: body64/48/32/24/16, empty/portion32/24/16; sealed/empty/portion≤20000byte, open/p1/p2≤30000byte. Main tổng≤60000byte. Mọi subpackage≤4MB.
-qa.mjs inspect('delivery') và inspect('all') viết qa/manifest/progress. Toàn request chỉ complete khi đủ304 và không lỗi. Có thể nodeRepl.write summary, tránh in260 path pending.
-preview-foods.ps1 -Group delivery ghép món đã có open; các ô thiếu ghi PENDING. contact.ps1 chỉ dùng kiểm nguồn.
-package-group.ps1 -Group delivery -DateTag 20261108 đã tạo và kiểm gói Delivery đủ 90 PNG.

## Lưu file an toàn khi chạy nhiều gen

-Không để các thao tác lưu nguồn phụ thuộc vào một Node REPL đang encode lâu. Mới nhất dùng Copy-Item/PowerShell, kèm một record generation JSON riêng, rồi gộp log. Nếu lỗi runner spawn_ready, retry sau khi runner sẵn; không phải thiếu quyền user.
-Giữ kết quả ImageGen và đường dẫn gốc trước khi lưu. Dùng jobs-meals.json và các generation record trên disk để phục hồi khi runner reset.
-Nếu exec_command trả session_id, poll bằng write_stdin cho tới exit trước mọi bước phụ thuộc. Không xuất từ registered PNG chưa ghi xong.
-Dùng namespace tools.mcp__node_repl__js và tự khởi tạo fs,b,module mỗi call để chịu được kernel reset.




