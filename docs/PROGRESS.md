# Mukbang Bang — tiến trình & bàn giao (03/11/2026)

> **Art V3 đợt 1 đã ghép (05/11):** streamer V3 (đầu/thân/mặt/FX, neo riêng từng người), phòng stream bitmap có cửa sổ trong suốt, food3 cho hoạt động phụ (hạ 384 px, subpackage `art3`), logo/coin/sao V3. Đồ ăn V1 chuyển sang subpackage `art1`. Gói: main 3,49 MB, art1 1,34, art3 1,83, art4 1,03. Yêu cầu Codex tiếp: `docs/ART-REQUEST-V4-POLISH.md`.
>
> **Art V4 core (05/11):** bếp dùng art thật (nền, khuôn + thạch tô theo vị, chai vị, topping, deco, 7 dụng cụ); thạch/khuôn/nền ở subpackage `art4`. **Art V4 đợt tạm (04/11):** feature icons + icon khuôn đã vào game; phần còn lại lưu ở `art-src/art-v4-partial-20261104/`, xem `docs/ART-V4-PARTIAL-CHECK.md`.
>
> **V4 (hiện tại)** — làm theo video: viewer yêu cầu món → **tự nấu** theo từng bước chọn (khay 4 ô + ✓, rót/giữ dụng cụ/lật/đặt/chà) → PERFECT! → stream ăn 3 đĩa × 3 miếng → MISSION COMPLETE; 40 màn, 8 công thức; chợ/giao hàng/buffet là hoạt động phụ; 13 ad place (thêm `fan_gift`, `rare_choice`, `cook_step`, `serve_bonus`, `extra_hype`, `unlock_level`, `unlock_look`), cooldown 30 s. Thiết kế + kết quả mô phỏng: `docs/GAME-DESIGN-V4.md`. V3 (`docs/GAME-DESIGN-V3.md`) là lịch sử của vòng mở gói, nay chỉ còn trong hoạt động phụ.
>
> **V3 (hiện tại)** — vòng ăn 1 món: mở gói → 3 gắp × 3 miếng → VIRAL; 50 stream; 4 hoạt động tuỳ chọn ở Home; Wardrobe; 6 ad place đo impression thật, cooldown 30 s. Thiết kế + QA: `docs/GAME-DESIGN-V3.md`. Art mới: `docs/ART-DIRECTION-V3.md` (chờ Codex). V2 (`docs/GAME-DESIGN-V2.md`) chỉ còn là lịch sử; các mục V1 bên dưới về HS kit / lệnh / quy ước vẫn đúng.

Tài liệu cho người/AI tiếp quản. Đọc hết file này trước khi sửa code.

## 1. Mục tiêu của chủ dự án

- Làm game **Mukbang Bang** dựa theo tư liệu trong `ref/` (video quảng cáo 26 s + 15 ảnh chụp của game thương mại "Mukbang ASMR Livestream Party"). Yêu cầu gốc: "làm y hệt về gameplay, logic, anime, levels và economy", ra **bản v1 hoàn chỉnh** rồi mới xem; sau đó sửa dần.
- Đã thống nhất với chủ dự án: làm **đúng vòng chơi và cảm giác** của bản gốc, nhưng hình, nhân vật, tên, lời thoại, số liệu level/economy là **thiết kế gốc** (không sao chép tài sản của game thương mại). Nếu chủ dự án đưa bộ art riêng thì thay vào.
- Nền tảng: **TikTok Minis native** (`game.js` + canvas), dùng **HS SDK kit 3.2.4 / SDK 1.1.3**; cùng code chạy Android (HS đóng gói) và web (shim của kit).
- Ngôn ngữ trong game: tiếng Anh. Trao đổi với chủ dự án: tiếng Việt.

## 2. Trạng thái hiện tại — v1 xong, chơi được

| Hạng mục | Trạng thái |
|---|---|
| Vòng chơi đầy đủ: Home → Siêu thị → Quầy quét → Livestream → Kết quả | ✅ |
| 30 level, 6 kệ (36 món), 3 streamer, 5 bối cảnh, sao 1–3 | ✅ |
| Economy (luôn lãi), mốc lượt xem có tip, thưởng level đầu | ✅ |
| Lưu tiến trình trong HSGame profile (cloud), stream dở dang khôi phục sau khi tắt app | ✅ |
| HS kit: rewards, 3 ad place, shop, nút TikTok review (Entry/Launch/Share), pause/resume | ✅ |
| `hs-check`: **0 ❌, 14 ⚠️** (chỉ thiếu App ID + 13 ad unit id) | ✅ |
| `tools/sim-test.mjs` V4: nấu + ăn bằng thao tác chạm thật, 8 công thức, lưu/tiếp tục, ads; mô phỏng 5 hồ sơ × 40 màn — all passed. 110 kiểm tra. Average: playtime 48′, **6.9 imps/5 phút (KPI 8 chưa đạt)** | ✅ |
| Bản web 1 file + artifact claude.ai | ✅ https://claude.ai/artifact/UJSpdJhdEptJPLshp2J9Nw (riêng tư, của chủ dự án) |
| Repo GitHub `greenteeceo/mukbang-bang` (private), nhánh `main` | ✅ commit mới nhất `1f2b304` |
| **Art bitmap từ Codex (143 ảnh, 2.6 MB) đã tích hợp**: món ăn, 3 streamer ghép lớp + 9 biểu cảm, 5 nền, siêu thị, quầy quét, icon, emoji, avatar, logo. Code vẽ canvas cũ giữ làm fallback | ✅ |
| Playtest người thật trên điện thoại / TikTok DevTool | ❌ chưa |
| Upload TikTok | ❌ chờ App ID |

## 3. Cấu trúc

```
mukbang bang/
  mukbang-bang/                  GÓI TIKTOK — mọi file ở đây bị upload. Không để gì khác vào.
    game.js                      entry: DEFAULTS (rewards/items), HSGame.profile, adapter tt.*, wrapper hs.* (mọi key/place viết literal ở đây)
    game.json, project.config.json (appid đang trống)
    hs-game.js, hs-sdk.min.js    2 file của kit — KHÔNG sửa
    src/data.js                  nội dung: TASTES, CATS, FOODS(36), level(n), STREAMERS, BACKGROUNDS, CHAT, MILESTONES, COLORS
    src/art.js                   hàm vẽ công khai: dùng sprite khi ảnh đã nạp, nếu chưa thì gọi bản vẽ canvas *Vec (fallback)
    src/sprites.js               nạp ảnh lazy qua platform.loadImage (tt.createImage), toạ độ atlas/neo từ assets/manifest.json; nền giữ tối đa 3 ảnh trong RAM
    assets/                      art bitmap (food/ streamer/ bg/ store/ ui/ + manifest.json) — nằm trong gói TikTok (gói ~3.0 MB < 4 MB)
    src/ui.js                    UI immediate-mode (button/panel/label/title/hotspot), toạ độ logic rộng 540
    src/audio.js                 âm thanh tổng hợp PCM (crunch, slurp, gulp, fizz, fire, beep, cash…)
    src/game.js                  class Game: máy trạng thái, run/stream, HUD, siêu thị + quầy quét (tự quét)
    src/scenes.js                V2: màn Delivery (app YUMGO + xe giao), Buffet (kẹp + đĩa), Kitchen (công thức + bước nấu)
    src/catalog.js               V2: 4 catalog món (siêu thị / delivery / buffet / DIY / mystery) + topping + request
    src/levels.js                V3: 50 stream (1 món/stream), kiểu bao bì, sự kiện fan, mở khoá, cấu hình hoạt động
    src/stream.js                V3: vòng ăn (sealed → open → 3 gắp × 3 miếng → empty → VIRAL), sự kiện fan, lưu/khôi phục, kết quả
    src/wardrobe.js / wardrobe-scene.js  V3: dữ liệu + vẽ phụ kiện / màn Wardrobe
  mukbang-bang.hs-dashboard.json dữ liệu dashboard HS (đặt CẠNH game folder, không bên trong)
  tools/sim-test.mjs             test headless: fake platform/profile/HS, chơi trọn level qua tap/drag thật
  tools/shot.sh                  chụp màn hình bằng Chrome headless (cần preview đang chạy)
  tools/build-web.mjs            build web/index.html + web/mukbang-bang-artifact.html (nhúng assets/ dạng data URI vào __HS_ASSETS)
  art-src/                       ngoài gói: previews của Codex, prompts.json, validation.json, CODEX-HANDOFF.md
  icon-512.png                   icon app (cho Android pack), ngoài gói TikTok
  docs/ART-REQUEST.md            brief art đã gửi Codex
  web/                           bản web (sinh ra bởi build-web — đừng sửa tay)
  docs/PROGRESS.md               file này
  README.md                      tổng quan + economy
```

Trong zip bàn giao còn có (không nằm trong git):
- `_kit/hs-sdk-1.1.3/` — bản sao bộ HS kit (gốc ở máy cũ: `D:\New\REF\hs-sdk-1.1.3\hs-sdk-1.1.3\`). Luôn để **ngoài** game folder.
- `_ref/` — video + ảnh tham khảo (gốc: `D:\Worldspace\ref\Mukbang bang\`).

## 4. Lệnh

```sh
KIT=_kit/hs-sdk-1.1.3                                   # hoặc đường dẫn kit trên máy bạn
node $KIT/hs-check.mjs mukbang-bang                     # phải 0 ❌
node tools/sim-test.mjs                                 # phải "all passed"
node $KIT/web/hs-web.mjs preview mukbang-bang --port 8090   # http://127.0.0.1:8090/ ; game frame: /__hs_frame.html#auto=<màn>:<level>
HS_KIT=$KIT node tools/build-web.mjs                    # build bản web + artifact
bash tools/shot.sh <out> [home market checkout stream result levels streamers]
```

`#auto=` (chỉ trên trình duyệt): `home | market | checkout | stream | result | levels | streamers`, ví dụ `#auto=stream:5`. Thêm `&debug` để in kích thước canvas.

Lưu ý Windows: Chrome headless ép cửa sổ rộng tối thiểu 548 px → `shot.sh` chụp 548×1186; tiến trình chrome headless hay treo lại, script tự kill (chỉ những process có `--headless`).

## 5. Thiết kế đã chốt

### Vòng chơi
1. **Market**: kệ theo danh mục (‹ › đổi kệ), 6 món/kệ, giá theo kệ. Chạm món → bay vào giỏ; chạm món trong giỏ → bỏ ra. Đủ N món → nút GO. Không cho chọn nếu thiếu coin (toast + nút "+"). Hàng thứ 3 xem trước kệ sắp mở (khoá).
2. **Checkout**: kéo món lên khe quét (hoặc chạm → bay tới), hoá đơn cộng dồn, quét xong → trừ coin, "Thank you!" + gấu thu ngân, 1.6 s sau vào stream. Lúc này `run_json` được ghi.
3. **Stream**: kéo món tới miệng (bán kính 92), giữ → cắn mỗi 0.72 s. Mỗi miếng: +viewers, +coin (cộng thẳng vào profile), biểu cảm theo vị, âm thanh, emoji, chat. Hết món → "STREAM COMPLETE!" → kết quả.
4. **Result**: sao theo peak viewers (≥ goal = 2★, ≥ goal3 = 3★, còn lại 1★), coin kiếm được, level bonus lần đầu, mở khoá. Nút: xem ad bonus, NEXT, REPLAY, HOME.

### Economy (src/data.js)
- Giá kệ: noodles 200, snacks 150, drinks 150, cakes 300, ice cream 250, fruit 200. Số miếng: 4/3/3/4/3/3.
- Mỗi miếng: viewers += giá × 0.6 × hệ số vị (±15% ngẫu nhiên); coin += giá × 1.8 × hệ số vị / số miếng.
- Hệ số vị: savory 1, sweet 1.15, fizzy 1.25, sour 1.3, cold 1.4, spicy 1.6.
- Mốc 1K, 2K, 5K, 10K, 20K, 50K, 100K, 200K viewers: tip = mốc / 20 coin.
- Level n: giỏ 3 (n≤3), 4 (≤8), 5 (≤15), 6; viewers đầu = 400 + 300n; goal = làm tròn(viewers đầu + 520 × giỏ); goal3 = goal × 1.35. Viewers tụt rất chậm về mức đầu khi không ăn.
- Mở kệ: drinks L2, cakes L4, ice cream L6, fruit L9. Streamer: Luna L1, Kiko L8, Momo L16. Bối cảnh đổi mỗi 6 level (park, beach, sakura, room, city).
- Coin khởi đầu 1000.

### HS kit — câu trả lời chủ dự án đã duyệt ("ok")
- SAVE `cloud`; Game ID / SDK key: **chưa có** (để trống, chạy offline).
- Q1: popup hệ thống; summary `level`. Q3: không có nút đăng nhập.
- Q2: **có bán**: Coin pouch (1,000), Coin chest (5,000), No Ads (`consumable: false`).
- Ad place: `stream_end` (interstitial trong tap NEXT/REPLAY, chỉ khi level > 3, bỏ qua nếu `no_ads`), `bonus_coins` (rewarded, màn kết quả, ẩn sau khi xem), `free_coins` (rewarded, nút "+" cạnh coin → popup).
- Q4: 3 level đầu không interstitial; cooldown 90 s (interstitial) / 30 s (rewarded) trong dashboard JSON; `level_bonus` trả 1 lần/level qua `levels_done`; `first_stream` `$limit once`; `share` daily.
- Profile: `level`(max) `levels_done`(max) `coins` `streamer` `stars_json` `run_json` `streams`(max) `best_viewers`(max) `no_ads`(max) `sound`(local).
- Quy tắc kit quan trọng: mọi `HSGame.claim/showAd/has/...` viết key literal trong `game.js`; `showAd` chỉ trong tap handler; không tự cộng phần thưởng; không dùng localStorage cho tiến trình; nút phụ thuộc nền tảng chỉ vẽ khi `HSGame.has(...)`.

## 6. Việc còn lại / gợi ý tiếp theo

**Cần từ chủ dự án**
1. TikTok App ID → `mukbang-bang/project.config.json` `"appid"`; rồi "build tiktok": `node $KIT/web/hs-web.mjs pack mukbang-bang --tiktok`.
2. 3 ad unit id (`ad…`) thay `<AD UNIT ID>` trong `mukbang-bang.hs-dashboard.json`.
3. HS Game ID + SDK key → `HSGame.start({ gameId, sdkKey })` trong `game.js`. **Không bao giờ** nhận/ghi Client Secret.
4. Bản Android (khi muốn): `<game>.android.json` + icon 512 → `hs-web.mjs pack mukbang-bang`.

**Để version sau (đã thống nhất)**
- 2 màn phụ thấy trong ảnh tham khảo: quầy tiện lợi "nhớ đơn hàng" (bong bóng đơn 3 món, đếm 6/9, chọn từ 3 thẻ) và khay buffet gắp bằng kẹp.
- Lớp FX trôi cho nền (mây, cánh hoa, sao) bằng ảnh — tuỳ chọn, chưa có.
- Có thể thêm: nhiều streamer cùng bàn (như ảnh tham khảo), nhạc nền, rung/hiệu ứng mạnh hơn khi ăn cay/lạnh.

**Rủi ro / chưa kiểm**
- Chưa playtest trên máy thật/TikTok DevTool (chỉ preview kit + Chrome headless + sim-test).
- Độ khó/economy mới cân bằng bằng công thức; cần chơi thật để chỉnh.
- Font là `sans-serif` hệ thống (TikTok không có font tuỳ chỉnh trừ khi `tt.loadFont`).

## 7. Quy ước làm việc của chủ dự án (từ CLAUDE.md máy cũ)

- Mọi dự án ở `D:\New\<tên>\`, workspace VS Code ở `D:\New\WS\<tên>.code-workspace` (dự án này: `D:\New\mukbang bang\`, `D:\New\WS\mukbang bang.code-workspace`). `D:\New\REF\` chỉ là tài liệu tham khảo.
- Game dùng HS kit ở `D:\New\REF\hs-sdk-1.1.3\hs-sdk-1.1.3\`; chỉ copy `hs-game.js` + `hs-sdk.min.js` vào game folder.
- Repo private trên GitHub `greenteeceo`; sau mỗi phần việc: commit message ngắn rõ + `git push`, không cần hỏi. Kiểm tra không commit secret/file > 50 MB. Không force-push.
- File `CHAT-HISTORY-2026-11-03.md` trong thư mục dự án do chủ dự án tạo, chưa đưa vào git — hỏi trước khi commit/xoá.
