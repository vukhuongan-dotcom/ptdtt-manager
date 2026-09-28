// Playwright End-to-End Verification for Smart Duplicate Surgery Detection
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8089;
const ROOT = path.resolve(__dirname, '..');

// Simple static server
const server = http.createServer((req, res) => {
    let filePath = path.join(ROOT, req.url.split('?')[0]);
    if (filePath.endsWith('/') || filePath === ROOT) filePath = path.join(ROOT, 'index.html');

    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png'
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

async function run() {
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Test server running at http://localhost:${PORT}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(`http://localhost:${PORT}`);

        // Navigate to Surgery page
        console.log('1. Navigating to Surgery Schedule...');
        await page.evaluate(() => {
            const adminSession = {
                staffId: 1,
                username: 'vkan',
                name: 'BSCKII. Vũ Khương An',
                role: 'Trưởng khoa / Bác sĩ',
                isAdmin: true,
                isSuperAdmin: true,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('ptdtt_session', JSON.stringify(adminSession));

            const todayStr = '2026-09-28';
            const testSurgery = {
                id: 9001,
                patientName: 'Nguyễn Văn Kiểm Thử',
                birthYear: 1985,
                admissionId: 'BA999888',
                surgeryType: 'chuongtrinh',
                approachType: 'noisoi',
                date: todayStr,
                duration: 90,
                mainSurgeon: 1,
                diagnosis: 'K đại tràng góc gan',
                method: 'PTNS cắt đại tràng phải',
                notes: 'Ca mẫu thử nghiệm',
                isFirstCase: true
            };

            if (typeof Store !== 'undefined' && Store._data && Store._data.surgeries) {
                Store._data.surgeries.unshift(testSurgery);
            }
            App.navigate('surgery');
        });
        await page.waitForTimeout(300);

        // Open Add Surgery Modal
        console.log('2. Opening Add Surgery Modal...');
        await page.evaluate(() => {
            SurgeryPage.openForm(0);
        });
        await page.waitForSelector('#modal form', { state: 'visible' });

        // Fill form with duplicate patient name and birth year
        console.log('3. Typing duplicate patient info to trigger realtime inline banner...');
        await page.fill('input[name="patientName"]', 'Nguyễn Văn Kiểm Thử');
        await page.fill('input[name="birthYear"]', '1985');
        await page.waitForTimeout(400); // wait for 250ms debounce

        // Check if inline banner appeared
        const bannerVisible = await page.isVisible('#surgery-duplicate-banner');
        const bannerText = await page.textContent('#surgery-duplicate-banner');
        console.log('   Inline banner visible:', bannerVisible);
        console.log('   Banner text snippet:', bannerText.trim().substring(0, 80));
        if (!bannerVisible || !bannerText.includes('Nguyễn Văn Kiểm Thử')) {
            throw new Error('Inline banner failed to appear for duplicate patient');
        }
        console.log('✅ Realtime inline duplicate banner verified!');

        // Fill other required fields
        await page.fill('input[name="admissionId"]', 'BA999888');
        await page.selectOption('select[name="approachType"]', 'noisoi');
        await page.fill('input[name="diagnosis"]', 'Ca mổ lần 2 trong tuần');

        // Submit form -> Should trigger sub-dialog
        console.log('4. Submitting form with duplicate data (expecting sub-dialog)...');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#surgery-duplicate-dialog', { state: 'visible' });

        const dialogTitle = await page.textContent('.dup-dialog-title');
        console.log('   Sub-dialog appeared with title:', dialogTitle.trim());
        if (!dialogTitle.includes('Phát hiện ca mổ trùng')) {
            throw new Error('Duplicate confirm sub-dialog did not show proper title');
        }

        // Test cancel: click "Hủy / Quay lại chỉnh sửa"
        console.log('5. Testing Cancel button (verifying form inputs preservation)...');
        await page.click('button:has-text("Hủy / Quay lại chỉnh sửa")');
        await page.waitForTimeout(200);

        const subDialogExists = await page.$('#surgery-duplicate-dialog');
        if (subDialogExists) throw new Error('Sub-dialog did not close upon cancel');

        // Verify form fields are preserved
        const preservedName = await page.inputValue('input[name="patientName"]');
        const preservedDiag = await page.inputValue('input[name="diagnosis"]');
        console.log('   Form preserved patientName:', preservedName);
        console.log('   Form preserved diagnosis:', preservedDiag);
        if (preservedName !== 'Nguyễn Văn Kiểm Thử' || preservedDiag !== 'Ca mổ lần 2 trong tuần') {
            throw new Error('Form fields were lost when cancelling sub-dialog!');
        }
        console.log('✅ Sub-dialog Cancel preserves all form inputs!');

        // Submit again to open sub-dialog and override with "same_patient_multicase"
        console.log('6. Submitting again to test Override same_patient_multicase...');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#surgery-duplicate-dialog', { state: 'visible' });

        // Ensure "same_patient_multicase" is selected
        await page.check('input[value="same_patient_multicase"]');
        await page.click('button:has-text("Vẫn tạo ca này")');
        await page.waitForTimeout(500);

        // Verify modal closed and badge appeared
        const modalVisible = await page.isVisible('#modal.active');
        console.log('   Modal closed:', !modalVisible);

        // Check surgery badge on schedule
        const badgeContent = await page.evaluate(() => {
            const el = document.querySelector('.badge-duplicate-patient');
            return el ? el.textContent : null;
        });
        console.log('   Badge rendered on calendar:', badgeContent);
        if (!badgeContent || !badgeContent.includes('ca/tuần')) {
            throw new Error('Badge for multi-case patient failed to render on schedule');
        }
        console.log('✅ Patient multi-case badge successfully verified on calendar!');

        console.log('\n=======================================');
        console.log('🎉 ALL PLAYWRIGHT E2E TESTS PASSED 100%!');
        console.log('=======================================\n');

    } finally {
        await browser.close();
        server.close();
    }
}

run().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
