from PIL import Image

def generate_icons():
    # Load full master logo
    master = Image.open('docs/brand/img/logo-khoa.png').convert('RGBA')
    w, h = master.size

    # 1. Standard 512x512
    # Place 480x480 logo centered on 512x512 white background
    icon512 = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
    paste_x = (512 - w) // 2
    paste_y = (512 - h) // 2
    icon512.paste(master, (paste_x, paste_y), master)
    icon512.save('img/icon-512.png', 'PNG')
    print('Generated img/icon-512.png')

    # 2. Standard 192x192
    icon192 = icon512.resize((192, 192), Image.Resampling.LANCZOS)
    icon192.save('img/icon-192.png', 'PNG')
    print('Generated img/icon-192.png')

    # 3. Apple touch icon 180x180
    apple_icon = icon512.resize((180, 180), Image.Resampling.LANCZOS)
    apple_icon.save('img/apple-touch-icon.png', 'PNG')
    print('Generated img/apple-touch-icon.png')

    # 4. Maskable 512x512
    # Safe zone is inner 80% circle (diameter 409px). Scale master (480) to ~390 to be safe.
    maskable_w, maskable_h = 390, 390
    scaled_master = master.resize((maskable_w, maskable_h), Image.Resampling.LANCZOS)
    maskable512 = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
    mx = (512 - maskable_w) // 2
    my = (512 - maskable_h) // 2
    maskable512.paste(scaled_master, (mx, my), scaled_master)
    maskable512.save('img/icon-maskable-512.png', 'PNG')
    print('Generated img/icon-maskable-512.png')

    # 5. Maskable 192x192
    maskable192 = maskable512.resize((192, 192), Image.Resampling.LANCZOS)
    maskable192.save('img/icon-maskable-192.png', 'PNG')
    print('Generated img/icon-maskable-192.png')

    # Also sync to docs/brand/img/
    for fname in ['icon-512.png', 'icon-192.png', 'apple-touch-icon.png', 'icon-maskable-512.png', 'icon-maskable-192.png']:
        img = Image.open(f'img/{fname}')
        img.save(f'docs/brand/img/{fname}', 'PNG')
        print(f'Synced docs/brand/img/{fname}')

if __name__ == '__main__':
    generate_icons()
