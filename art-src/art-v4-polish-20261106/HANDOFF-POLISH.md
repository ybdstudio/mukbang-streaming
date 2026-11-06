# Mukbang V4 polish — bàn giao 61 file

Đã xuất đủ CHECKLIST-V4-POLISH.csv. Chỉ bàn giao art; dev tích hợp vào game.

- art4/bite: 39 PNG 400×400, neo [200,200]. Sáu món có fill rồi detail; ramen là màu thật. Trạng thái 0 nguyên, 1 đã cắn, 2 còn miếng cuối. Sau đó ẩn cả hai lớp.
- Fill xám trung tính để multiply theo vị; detail giữ màu, không tint. Mặt nạ màu cyan trong nguồn chỉ là khóa tách lớp kỹ thuật, không xuất vào runtime. Thìa/đũa và các trạng thái dùng phép căn chung theo từng family.
- assets/cook: bốn atlas 512×128, bốn frame 128×128 từ trái qua phải, neo mỗi frame [64,64]. fx_pour multiply theo vị. pip_on 40×40 neo [20,20]. Thay file pip_on cũ bằng bản trong gói này.
- art3/food3: soda_pop và rainbow_candy, mỗi món sealed/open/p1/p2/empty/portion, 384×384, neo [192,192]. Portion chỉ là phần đồ ăn rời, không có bao bì.
- art3/bg: năm cảnh 720×680, JPEG quality80. Không có khung cửa; dev crop phủ cửa sổ, trọng tâm dọc khoảng35% theo brief.

PNG indexed palette alpha, không dither. Manifest có kích thước, package, neo, frame và SHA256. qa.json ghi ngân sách tăng thêm và baseline subpackage ước tính từ brief. Không tính nguồn và preview vào runtime.

generation-log.json chứa prompt thực tế và đường dẫn tham chiếu; selection.json nối nguồn chọn với SHA256 PNG cuối. Ảnh nguồn ở production-polish/sources trong workspace. registration.json, atlas-registration.json, layer-separation.json và atlas-alpha-export.json ghi các bước resample, tách lớp và xuất alpha. Các preview cuối cùng ở previews/.

Wardrobe là request bổ sung riêng gồm78 file, chưa nằm trong ZIP này. Công cụ ImageGen đã chạm hạn mức trước khi sinh được mẫu Wardrobe; mốc reset công cụ báo là06/11/2026 16:51:43 giờ Việt Nam. Spec, tham chiếu và jobs đã lưu trong production-wardrobe để tiếp tục.
