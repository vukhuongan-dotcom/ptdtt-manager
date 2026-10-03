import os
import base64
from playwright.sync_api import sync_playwright

def export_test_reports():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:8080/")
        page.wait_for_selector("#app")
        page.wait_for_timeout(1000)

        res = page.evaluate('''() => {
            const r16 = {
                date: '2026-10-02',
                totalPatients: 42,
                postOpNotReturned: 3,
                admissions: 5,
                discharges: 4,
                severePatients: 1,
                surgeryTotal: 8,
                surgeryCT: 5,
                surgeryYC: 2,
                surgeryRobot: 1,
                surgeryDay: '2026-10-05',
                notes: 'Theo dõi 1 ca xì miệng nối sau mổ K đại tràng ngày 4.',
                reporterName: 'BS. Vũ Khương An'
            };

            const r7 = {
                date: '2026-10-03',
                totalPatients: 45,
                fromHSCC: 2,
                fromHSCCDetail: '1 ca viêm phúc mạc ruột thừa, 1 ca tắc ruột',
                fromHoiTinh: 3,
                fromHoiTinhDetail: '3 ca hậu phẫu nội soi ổn định',
                fromICU: 0,
                fromGiaiAp: 1,
                fromGiaiApDetail: '1 ca K trực tràng sau mổ Hartmann',
                notes: 'Các ca theo dõi sinh hiệu ổn định, không có biến cố bất thường.',
                reporterName: 'BS. Vũ Khương An'
            };

            let dataUrl16 = null;
            let dataUrl7 = null;

            // Patch URL.createObjectURL to convert Blob to dataURL
            return new Promise((resolve) => {
                const origCreate = URL.createObjectURL;
                const blobs = [];
                URL.createObjectURL = (blob) => {
                    blobs.push(blob);
                    return origCreate(blob);
                };

                ReportsPage.selectedDate = '2026-10-02';
                ReportsPage._drawAndDownload(r16);

                ReportsPage.selectedDate = '2026-10-03';
                ReportsPage._drawAndDownload7h(r7);

                URL.createObjectURL = origCreate;

                const readBlob = (blob) => new Promise((res) => {
                    const reader = new FileReader();
                    reader.onload = () => res(reader.result);
                    reader.readAsDataURL(blob);
                });

                Promise.all(blobs.map(readBlob)).then(urls => {
                    resolve({ dataUrl16: urls[0], dataUrl7: urls[1] });
                });
            });
        }''')

        os.makedirs("screenshots/reports_test", exist_ok=True)
        if res.get("dataUrl16"):
            with open("screenshots/reports_test/report_16h_brand.png", "wb") as f:
                f.write(base64.b64decode(res["dataUrl16"].split(",")[1]))
            print("Successfully saved screenshots/reports_test/report_16h_brand.png")

        if res.get("dataUrl7"):
            with open("screenshots/reports_test/report_7h_brand.png", "wb") as f:
                f.write(base64.b64decode(res["dataUrl7"].split(",")[1]))
            print("Successfully saved screenshots/reports_test/report_7h_brand.png")

        browser.close()

if __name__ == '__main__':
    export_test_reports()
