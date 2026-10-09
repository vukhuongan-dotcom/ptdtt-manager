/**
 * staff-photos.js - Cấu hình danh sách ID nhân sự có ảnh chân dung chính thức
 * Được kiểm duyệt theo danh sách nhân sự đang công tác của Khoa PTĐTT
 */
const STAFF_PHOTO_IDS = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16,
    24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36,
    37, 38, 39, 40
]);

/**
 * Kích thước thật (native pixels) của ảnh chân dung -lg.webp
 * Giúp trình duyệt render đúng 1:1, không bị kéo giãn/nhoè
 */
const STAFF_PHOTO_DIMS = {
    1: { w: 204, h: 256 },
    2: { w: 213, h: 266 },
    3: { w: 177, h: 222 },
    4: { w: 180, h: 226 },
    5: { w: 213, h: 266 },
    6: { w: 178, h: 223 },
    7: { w: 179, h: 224 },
    8: { w: 212, h: 265 },
    9: { w: 203, h: 254 },
    10: { w: 200, h: 250 },
    11: { w: 177, h: 222 },
    12: { w: 213, h: 266 },
    16: { w: 198, h: 248 },
    24: { w: 213, h: 266 },
    25: { w: 213, h: 266 },
    26: { w: 198, h: 248 },
    27: { w: 206, h: 258 },
    28: { w: 213, h: 266 },
    29: { w: 213, h: 266 },
    30: { w: 193, h: 242 },
    31: { w: 213, h: 266 },
    32: { w: 213, h: 266 },
    33: { w: 214, h: 267 },
    35: { w: 213, h: 266 },
    36: { w: 213, h: 266 },
    37: { w: 213, h: 266 },
    38: { w: 208, h: 261 },
    39: { w: 213, h: 266 },
    40: { w: 213, h: 266 }
};
