const fs = require('fs');
const vm = require('vm');

const sandbox = {
    console,
    document: { querySelector: () => null, getElementById: () => null, documentElement: { setAttribute: () => {} } },
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { userAgent: 'Node' }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), sandbox);
vm.runInContext('Store.init()', sandbox);
vm.runInContext(fs.readFileSync('js/rooms.js', 'utf8'), sandbox);

const output = vm.runInContext(`
    ROOM_DATA.map(r => {
        const docs = r.doctors.map(d => {
            const staff = Store.getById('staff', d.id);
            return (staff ? staff.title + ' ' + staff.name : 'Unknown ' + d.id) + ' [' + d.role + ']';
        }).join(', ');
        return 'Phòng B' + r.room + ' (POD ' + r.pod + '): ' + docs;
    }).join('\\n');
`, sandbox);

console.log('=== KẾT QUẢ ÁNH XẠ SƠ ĐỒ PHÒNG BỆNH 3 POD MỚI ===');
console.log(output);
