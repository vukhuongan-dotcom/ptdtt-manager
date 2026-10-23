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
    1: { w: 480, h: 600 },
    2: { w: 480, h: 600 },
    3: { w: 177, h: 222 },
    4: { w: 480, h: 600 },
    5: { w: 480, h: 600 },
    6: { w: 178, h: 223 },
    7: { w: 480, h: 600 },
    8: { w: 480, h: 600 },
    9: { w: 480, h: 600 },
    10: { w: 480, h: 600 },
    11: { w: 480, h: 600 },
    12: { w: 480, h: 600 },
    16: { w: 480, h: 600 },
    24: { w: 480, h: 600 },
    25: { w: 480, h: 600 },
    26: { w: 480, h: 600 },
    27: { w: 480, h: 600 },
    28: { w: 480, h: 600 },
    29: { w: 213, h: 266 },
    30: { w: 480, h: 600 },
    31: { w: 480, h: 600 },
    32: { w: 480, h: 600 },
    33: { w: 480, h: 600 },
    35: { w: 480, h: 600 },
    36: { w: 480, h: 600 },
    37: { w: 480, h: 600 },
    38: { w: 480, h: 600 },
    39: { w: 480, h: 600 },
    40: { w: 480, h: 600 }
};
