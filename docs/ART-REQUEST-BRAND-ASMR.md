# Mukbang ASMR — yêu cầu art tên game mới (cho Codex)

Ngày 06/11/2026. Game đổi tên hiển thị từ **Mukbang Bang** thành **Mukbang ASMR** (TikTok App ID 7705201906184030215).
Logo cũ `ui/logo_v3.png` có chữ "Mukbang Bang" nên đã bị tắt. Màn chính hiện vẽ tạm chữ bằng code, xem `refs/home-now.png`.
Ba nút thưởng TikTok (Revisit / Launch / Share) đã nằm ở màn Levels với icon vẽ tạm bằng code, xem `refs/levels-now.png` và `refs/popups-now.png`.

Phong cách giữ như V3 đã duyệt: viền nâu ấm, pastel, bóng mềm. PNG palette có alpha, không dither, có padding. Kèm manifest fragment (kích thước, neo, package, SHA256) và 1 ảnh preview.
Gói main còn khoảng **0,4 MB**: mục 1–3 tổng ≤ 120 KB.

| # | file | kích thước | nội dung |
|---|---|---|---|
| 1 | `assets/ui/logo_asmr.png` | 720×300, neo giữa | Logo chữ **MUKBANG ASMR**: "MUKBANG" trắng viền hồng đậm, "ASMR" vàng to hơn ở dòng dưới; vài sóng âm (ASMR) hai bên và một đôi đũa / bát mì nhỏ. Nền trong suốt. |
| 2 | `assets/ui/mission_revisit.png` | 160×160 | Icon **Revisit reward**: hình người (trang cá nhân TikTok) + mũi tên vòng "quay lại". Không dùng logo TikTok. |
| 3 | `assets/ui/mission_launch.png` | 160×160 | Icon **Launch reward**: màn hình điện thoại có icon game và dấu "+" xanh (thêm vào màn hình chính). |
| 4 | `assets/ui/mission_share.png` | 160×160 | Icon **Share reward**: mũi tên chia sẻ cong ra khỏi hộp, vài trái tim nhỏ. |
| 5 | `mukbang-bang.icon-512.png` (để **ngoài** thư mục game) | 512×512, không trong suốt | **App icon**: mặt Luna cười đang húp mì (mì vàng), có tai nghe/sóng âm ASMR, nền hồng pastel. Không chữ, hoặc chỉ "ASMR" rất nhỏ. Nhìn rõ ở 64 px. |

Lưu ý TikTok review:
- Không vẽ logo hay chữ "TikTok" trong icon; chỉ minh hoạ hành động (trang cá nhân, màn hình chính, chia sẻ).
- Chữ trên nút (REVISIT / LAUNCH / SHARE, số coin) do game viết, không vẽ vào ảnh.

Thứ tự giao: 1 (logo) và 5 (app icon) trước, rồi 2–4.
