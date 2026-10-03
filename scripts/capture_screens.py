#!/usr/bin/env python3
import sys
import os
import time
from playwright.sync_api import sync_playwright

def capture(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    viewports = [
        ("mobile", {"width": 390, "height": 844}),
        ("desktop", {"width": 1440, "height": 900})
    ]
    
    pages = [
        ("dashboard", "tong_quan"),
        ("surgery", "lich_mo"),
        ("surgery-stats", "thong_ke_pt"),
        ("schedule", "phan_cong_tuan"),
        ("reports", "bao_cao"),
        ("login", "dang_nhap")
    ]
    
    themes = ["light", "dark"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for vp_name, vp_size in viewports:
            for theme in themes:
                context = browser.new_context(
                    viewport=vp_size,
                    color_scheme=theme
                )
                page = context.new_page()
                page.goto("http://localhost:8080/")
                page.wait_for_load_state("domcontentloaded")
                page.wait_for_selector("#app", state="visible")
                time.sleep(1.5) # wait for local db and charts
                
                # Set theme explicitly & dismiss onboarding
                page.evaluate(f"""
                    document.documentElement.setAttribute('data-theme', '{theme}');
                    localStorage.setItem('ptdtt_theme', '{theme}');
                    localStorage.setItem('ptdtt_onboarding_done', 'true');
                    const ob = document.getElementById('onboarding-overlay');
                    if (ob) ob.remove();
                    if (typeof App !== 'undefined' && App._updateThemeToggleUI) App._updateThemeToggleUI('{theme}');
                """)
                time.sleep(0.5)
                
                for page_id, page_alias in pages:
                    filename = f"{page_alias}_{vp_name}_{theme}.png"
                    filepath = os.path.join(output_dir, filename)
                    
                    if page_id == "login":
                        page.evaluate("App.showLogin()")
                        time.sleep(0.6)
                        page.screenshot(path=filepath, full_page=False)
                        print(f"Captured: {filepath}")
                        # Restore app
                        page.evaluate("App.showApp('dashboard')")
                        time.sleep(0.6)
                    elif page_id == "surgery":
                        page.evaluate("""
                            App.navigate('surgery');
                            if (typeof App !== 'undefined' && App.pages && App.pages['surgery']) {
                                App.pages['surgery'].currentWeekStart = new Date(2026, 6, 27);
                                App.renderCurrentPage();
                            }
                        """)
                        time.sleep(0.8)
                        page.screenshot(path=filepath, full_page=False)
                        print(f"Captured: {filepath}")
                    elif page_id == "surgery-stats":
                        page.evaluate("App.navigate('surgery-stats')")
                        time.sleep(1.0)
                        page.screenshot(path=filepath, full_page=False)
                        print(f"Captured: {filepath}")
                    else:
                        page.evaluate(f"App.navigate('{page_id}')")
                        time.sleep(0.8)
                        page.screenshot(path=filepath, full_page=False)
                        print(f"Captured: {filepath}")
                
                context.close()
        
        browser.close()

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "screenshots/before_brand"
    capture(out)
