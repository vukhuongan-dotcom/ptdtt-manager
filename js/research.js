// ===== RESEARCH / SHCM PAGE =====
const SHCM_STATUSES = {
    done: { label: 'Đã trình', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
    pending: { label: 'Chưa trình', color: '#ea580c', bg: '#fff7ed', icon: '⏳' },
    registered: { label: 'Mới đăng ký', color: '#7c3aed', bg: '#f3e8ff', icon: '📝' }
};

const ResearchPage = {
    _canEdit() {
        const s = Auth.getSession();
        if (!s) return false;
        if (s.isAdmin) return true;
        const staff = Store.getAll('staff').find(st => st.id === s.staffId);
        if (!staff) return false;
        return staff.role.includes('Bác sĩ chính') || staff.role.includes('Trưởng khoa') || staff.role.includes('Phó trưởng khoa');
    },

    _getSettings() {
        const all = Store.getAll('shcmSettings');
        if (all && all.length > 0) return all[0];
        return { defaultTime: '15:30', defaultDuration: '30m' };
    },

    render() {
        const canEdit = this._canEdit();
        const items = Store.getAll('shcmSchedule').sort((a, b) => {
            if (a.presentDate && b.presentDate) return a.presentDate.localeCompare(b.presentDate);
            return a.id - b.id;
        });
        const settings = this._getSettings();

        // Stats
        const done = items.filter(i => i.status === 'done').length;
        const pending = items.filter(i => i.status === 'pending').length;
        const registered = items.filter(i => i.status === 'registered').length;

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Sinh hoạt Chuyên môn</h1>
                <p class="page-subtitle">Lịch SHCM & Tài liệu — Khoa PTĐTT · Bệnh viện Bình Dân</p>
            </div>
            ${canEdit ? `<button class="btn btn-primary" onclick="ResearchPage.openForm()">
                ${Utils.plusIcon()} Thêm bài SHCM
            </button>` : ''}
        </div>

        <!-- Stats cards -->
        <div class="rsch-stats">
            <div class="rsch-stat-card"><span class="rsch-stat-val">${items.length}</span><span class="rsch-stat-lbl">Tổng bài</span></div>
            <div class="rsch-stat-card rsch-done"><span class="rsch-stat-val">${done}</span><span class="rsch-stat-lbl">Đã trình</span></div>
            <div class="rsch-stat-card rsch-pending"><span class="rsch-stat-val">${pending}</span><span class="rsch-stat-lbl">Chưa trình</span></div>
            <div class="rsch-stat-card rsch-reg"><span class="rsch-stat-val">${registered}</span><span class="rsch-stat-lbl">Mới đăng ký</span></div>
        </div>

        <!-- Settings (admin only) -->
        ${canEdit ? `<div class="card rsch-settings-card">
            <div class="rsch-settings-row">
                <span class="rsch-settings-label">⚙️ Giờ mặc định SHCM:</span>
                <input type="time" class="form-input rsch-time-input" id="shcm-default-time" value="${settings.defaultTime}">
                <span class="rsch-settings-label">Thời lượng:</span>
                <input type="number" class="form-input rsch-dur-input" id="shcm-default-dur" value="${parseInt(settings.defaultDuration) || 30}" min="0" max="60" step="5">
                <span class="rsch-settings-unit">phút</span>
                <button class="btn btn-secondary btn-sm" onclick="ResearchPage.saveSettings()">Lưu</button>
            </div>
        </div>` : ''}

        <!-- SHCM Table -->
        <div class="card" style="padding:0;overflow:hidden">
            <div class="rsch-table-header">
                <h3>📋 Lịch Sinh hoạt Chuyên môn tại Khoa</h3>
            </div>
            <div class="rsch-table-wrap">
                <table class="rsch-table">
                    <thead>
                        <tr>
                            <th style="width:44px">STT</th>
                            <th style="min-width:160px">Bác sĩ</th>
                            <th>Tên bài</th>
                            <th style="width:110px">Tiến độ</th>
                            <th style="width:100px">Ngày trình</th>
                            ${canEdit ? '<th style="width:70px"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => {
                            const st = SHCM_STATUSES[item.status] || SHCM_STATUSES.pending;
                            const d = item.presentDate ? new Date(item.presentDate) : null;
                            const dateLabel = d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` : '—';
                            return `<tr class="rsch-row rsch-row-${item.status}">
                                <td class="rsch-stt">${idx + 1}</td>
                                <td class="rsch-doctor">${item.doctorName}</td>
                                <td class="rsch-title">${item.title}</td>
                                <td><span class="rsch-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.color}30">${st.icon} ${st.label}</span></td>
                                <td class="rsch-date">${dateLabel}</td>
                                ${canEdit ? `<td class="rsch-actions">
                                    <button class="btn-icon" onclick="ResearchPage.openForm(${item.id})" title="Sửa">✏️</button>
                                    <button class="btn-icon" onclick="ResearchPage.deleteItem(${item.id})" title="Xoá">🗑️</button>
                                </td>` : ''}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Files section -->
        <div class="card rsch-files-card">
            <div class="rsch-files-header">
                <h3>📁 Bài Sinh hoạt Chuyên môn đã có</h3>
                ${canEdit ? `<label class="btn btn-primary btn-sm rsch-upload-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload PDF
                    <input type="file" accept=".pdf" style="display:none" onchange="ResearchPage.uploadFile(this)">
                </label>` : ''}
            </div>
            <div id="shcm-files-list" class="rsch-files-list">
                <div style="text-align:center;padding:20px;color:var(--text-muted)">Đang tải danh sách file...</div>
            </div>
        </div>
        `;
    },

    afterRender() {
        this.loadFiles();
        this._syncAllPlans();
    },

    // Bulk-sync all SHCM entries → Plans (update existing + create missing)
    _syncAllPlans() {
        if (!this._canEdit()) return;
        const items = Store.getAll('shcmSchedule');
        let synced = 0;
        items.forEach(item => {
            if (!item.presentDate) return;
            // Always sync (create or update)
            this._syncPlan(item);
            synced++;
        });
        if (synced > 0) {
            console.log(`[SHCM] Synced ${synced} entries to Plans`);
        }
    },

    // ===== CRUD =====
    openForm(id) {
        if (!this._canEdit()) return;
        const item = id ? Store.getById('shcmSchedule', id) : null;
        const staff = Store.getAll('staff').filter(s =>
            s.role.includes('Bác sĩ') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa')
        );

        Modal.open(item ? 'Sửa bài SHCM' : 'Thêm bài SHCM', `
            <form onsubmit="ResearchPage.save(event, ${id || 0})">
                <div class="form-group">
                    <label class="form-label">Bác sĩ trình bày</label>
                    <select class="form-select" name="doctorId" required>
                        <option value="">— Chọn BS —</option>
                        ${staff.map(s => `<option value="${s.id}" ${item?.doctorId === s.id ? 'selected' : ''}>${s.title} ${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Tên bài trình bày</label>
                    <textarea class="form-textarea" name="title" required style="min-height:60px">${item?.title || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày trình</label>
                        <input class="form-input" type="date" name="presentDate" value="${item?.presentDate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tiến độ</label>
                        <select class="form-select" name="status">
                            ${Object.entries(SHCM_STATUSES).map(([k, v]) => `<option value="${k}" ${item?.status === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    ${item ? `<button type="button" class="btn btn-danger" onclick="ResearchPage.deleteItem(${id});Modal.close()">Xoá</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${item ? 'Cập nhật' : 'Thêm'}</button>
                </div>
            </form>
        `);
    },

    save(e, id) {
        if (!this._canEdit()) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const doctorId = parseInt(f.get('doctorId'));
        const staff = Store.getAll('staff').find(s => s.id === doctorId);
        const data = {
            doctorId,
            doctorName: staff ? `${staff.title} ${staff.name}` : '',
            title: f.get('title'),
            status: f.get('status'),
            presentDate: f.get('presentDate') || null,
        };

        if (id) {
            Store.update('shcmSchedule', id, data);
        } else {
            const newItem = Store.add('shcmSchedule', data);
            // Auto-shift: push all subsequent items forward by 2 weeks
            if (data.presentDate) {
                this._shiftSubsequentDates(newItem.id, data.presentDate);
            }
        }

        // Sync to plans
        this._syncPlan(id ? Store.getById('shcmSchedule', id) : Store.getAll('shcmSchedule').slice(-1)[0]);

        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật bài SHCM' : 'Đã thêm bài SHCM mới (lịch sau tự dời +2 tuần)');
    },

    // Shift all SHCM entries after insertedDate forward by 2 weeks
    _shiftSubsequentDates(newItemId, insertedDate) {
        const items = Store.getAll('shcmSchedule');
        let shifted = 0;
        items.forEach(item => {
            if (item.id === newItemId) return; // skip the newly inserted item
            if (!item.presentDate) return;
            if (item.presentDate >= insertedDate) {
                const d = new Date(item.presentDate);
                d.setDate(d.getDate() + 14); // +2 weeks
                const newDate = d.toISOString().split('T')[0];
                Store.update('shcmSchedule', item.id, { presentDate: newDate });
                // Also update linked plan
                if (item.planId) {
                    Store.update('plans', item.planId, { date: newDate });
                }
                shifted++;
            }
        });
        if (shifted > 0) {
            console.log(`[SHCM] Shifted ${shifted} entries forward by 2 weeks`);
        }
    },

    deleteItem(id) {
        if (!this._canEdit()) return;
        if (!confirm('Xoá bài SHCM này?')) return;
        // Remove linked plan
        const item = Store.getById('shcmSchedule', id);
        if (item?.planId) {
            Store.remove('plans', item.planId);
        }
        Store.remove('shcmSchedule', id);
        Modal.close();
        App.renderCurrentPage();
        Toast.success('Đã xoá bài SHCM');
    },

    // ===== Plan sync =====
    _syncPlan(item) {
        if (!item || !item.presentDate) return;
        const settings = this._getSettings();
        const planData = {
            title: `Sinh hoạt chuyên môn BS`,
            date: item.presentDate,
            time: settings.defaultTime,
            duration: settings.defaultDuration,
            type: 'training',
            responsible: item.doctorId,
            location: 'Phòng 7.14',
            note: `${item.doctorName}: ${item.title}`,
            source: 'shcm',
            shcmId: item.id
        };

        if (item.planId) {
            Store.update('plans', item.planId, planData);
        } else {
            const newPlan = Store.add('plans', planData);
            Store.update('shcmSchedule', item.id, { planId: newPlan.id });
        }
    },

    // ===== Settings =====
    saveSettings() {
        const time = document.getElementById('shcm-default-time')?.value || '15:30';
        const durVal = parseInt(document.getElementById('shcm-default-dur')?.value) || 30;
        const dur = durVal + 'm';
        const all = Store.getAll('shcmSettings');
        if (all && all.length > 0) {
            Store.update('shcmSettings', all[0].id, { defaultTime: time, defaultDuration: dur });
        } else {
            Store.add('shcmSettings', { defaultTime: time, defaultDuration: dur });
        }
        Toast.success('Đã lưu cài đặt giờ SHCM');
    },

    // ===== File management =====
    async loadFiles() {
        const container = document.getElementById('shcm-files-list');
        if (!container) return;
        try {
            const token = Auth.getToken();
            const resp = await fetch('/api/shcm/files', {
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (!resp.ok) throw new Error('Failed');
            const data = await resp.json();
            const files = data.files || [];
            const canEdit = this._canEdit();

            if (files.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">📂 Chưa có tài liệu nào được upload</div>';
                return;
            }

            container.innerHTML = files.map(f => `
                <div class="rsch-file-item">
                    <div class="rsch-file-icon">📄</div>
                    <div class="rsch-file-info">
                        <div class="rsch-file-name">${f.name}</div>
                        <div class="rsch-file-meta">${f.size} · ${f.uploaded || ''}</div>
                    </div>
                    <div class="rsch-file-actions">
                        <a href="/api/shcm/download/${encodeURIComponent(f.name)}" class="btn btn-secondary btn-sm" download>⬇️ Tải</a>
                        ${canEdit ? `<button class="btn btn-danger btn-sm" onclick="ResearchPage.deleteFile('${f.name.replace(/'/g, "\\'")}')">🗑️</button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger)">Không thể tải danh sách file</div>';
        }
    },

    async uploadFile(input) {
        if (!this._canEdit()) return;
        const file = input.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            Toast.error('Chỉ chấp nhận file PDF');
            input.value = '';
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            Toast.error('File quá lớn (tối đa 50MB)');
            input.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            Toast.info('Đang upload...');
            const token = Auth.getToken();
            const resp = await fetch('/api/shcm/upload', {
                method: 'POST',
                headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                body: formData
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Upload failed');
            }
            Toast.success('Upload thành công!');
            this.loadFiles();
        } catch (err) {
            Toast.error('Lỗi upload: ' + err.message);
        }
        input.value = '';
    },

    async deleteFile(filename) {
        if (!this._canEdit()) return;
        if (!confirm(`Xoá file "${filename}"?`)) return;
        try {
            const token = Auth.getToken();
            const resp = await fetch('/api/shcm/delete/' + encodeURIComponent(filename), {
                method: 'DELETE',
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (!resp.ok) throw new Error('Delete failed');
            Toast.success('Đã xoá file');
            this.loadFiles();
        } catch (err) {
            Toast.error('Lỗi xoá file');
        }
    }
};
