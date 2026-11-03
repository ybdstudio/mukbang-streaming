# Mukbang Bang

Game mukbang-livestream cho **TikTok Minis (native)** + bản Android qua HS kit. Vòng chơi mỗi level:

1. **Siêu thị** — chọn đủ N món (3 → 6 theo level) trên các kệ theo danh mục, giá theo loại, giỏ x/N và tổng tiền.
2. **Quầy tự thanh toán** — kéo (hoặc chạm) từng món vào máy quét, hoá đơn cộng dồn, "Thank you!", trừ coin.
3. **Livestream** — kéo đồ ăn lên miệng streamer; mỗi miếng cắn đổi biểu cảm theo vị (cay = phun lửa, lạnh = run, chua, ngọt, có ga…), emoji bay, chat trôi, LIVE 👁 tăng, coin tăng; mốc 1K/2K/5K… có tip.
4. **Kết quả** — sao (1–3 theo lượt xem đỉnh so với mục tiêu), coin kiếm được, thưởng level đầu, mở khoá kệ/streamer mới.

Toàn bộ hình (36 món ăn, 3 streamer với 9 biểu cảm, 5 bối cảnh, đạo cụ) vẽ bằng canvas; âm thanh tổng hợp PCM (crunch, slurp, gulp, fizz, beep…). Không có file ảnh/âm thanh nào.

## Chạy

```sh
node D:\New\REF\hs-sdk-1.1.3\hs-sdk-1.1.3\web\hs-web.mjs preview mukbang-bang   # xem trên "điện thoại giả", http://127.0.0.1:8090/
node D:\New\REF\hs-sdk-1.1.3\hs-sdk-1.1.3\hs-check.mjs mukbang-bang            # kiểm tra tích hợp HS (0 ❌)
node tools/sim-test.mjs                                                         # test logic headless: chơi trọn level qua tap/drag thật (108 kiểm tra)
bash tools/shot.sh <thư mục ra> [home market checkout stream result levels streamers]   # chụp màn hình (cần preview đang chạy)
```

Trong preview, `/__hs_frame.html#auto=<màn>:<level>` nhảy thẳng tới một màn với dữ liệu mẫu (chỉ trên trình duyệt).

## Cấu trúc

```
mukbang-bang/              gói TikTok (mọi thứ trong đây sẽ upload)
  game.js                  entry: nối HS kit (DEFAULTS, profile, adapter tt.*, wrapper hs.*)
  game.json, project.config.json, hs-game.js, hs-sdk.min.js
  src/data.js              danh mục, 36 món, vị, 30 level, streamer, bối cảnh, lời chat
  src/art.js               vẽ: món ăn (có tỉ lệ đã ăn), streamer + biểu cảm, nền (cache), đạo cụ, emoji, avatar
  src/ui.js                UI immediate-mode kiểu kawaii (nút, panel, chữ viền)
  src/audio.js             âm thanh tổng hợp
  src/game.js              máy trạng thái: home, levels, streamers, market, checkout, stream, pause, result, coins, hsshop, popup
mukbang-bang.hs-dashboard.json   dữ liệu dashboard HS (3 ad place, 7 reward key, 2 item, 3 product)
tools/sim-test.mjs, tools/shot.sh
```

## HS kit (3.2.4 / SDK 1.1.3)

- **Profile** (cloud; `sound` local): `level`↑ `levels_done`↑ `coins` `streamer` `stars_json` `run_json` (stream dở dang — thoát app vẫn tiếp tục được) `streams`↑ `best_viewers`↑ `no_ads`↑. Tóm tắt khi xung đột: `level`.
- **Claim**: `level_bonus` (lần đầu qua mỗi level), `first_stream` (once), `share` (daily), `tiktok_profile`, `tiktok_shortcut`.
- **Ad place**: `stream_end` xen kẽ khi bấm NEXT/REPLAY sau level 3 (cooldown 90 s, tắt khi có No Ads); `bonus_coins` nút xem ad ở màn kết quả; `free_coins` nút "+" cạnh coin (cooldown 30 s).
- **Shop**: Coin pouch / Coin chest / No Ads (`consumable: false`).
- Chưa có: TikTok App ID (`project.config.json` → `appid`), 3 ad unit id trong dashboard JSON, Game ID + SDK key (`HSGame.start`). Game chạy offline đầy đủ cho tới khi điền.

## Economy

Giá: noodles 200 · snacks 150 · drinks 150 · cakes 300 · ice cream 250 · fruit 200. Mỗi miếng cắn: lượt xem += giá × 0.6 × hệ số vị, coin += giá × 1.8 × hệ số vị / số miếng → mỗi level luôn lãi ≥ 1.5× tiền mua (`sim-test` kiểm tra). Hệ số vị: savory 1 · sweet 1.15 · fizzy 1.25 · sour 1.3 · cold 1.4 · spicy 1.6. Mục tiêu level n: `400 + 300n + 520 × giỏ`; 3 sao = ×1.35. Mở kệ: drinks L2, cakes L4, ice cream L6, fruit L9; streamer Kiko L8, Momo L16; bối cảnh đổi mỗi 6 level.
