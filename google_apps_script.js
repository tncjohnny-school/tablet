/**
 * ========================================================
 * 校園平板借用系統 - Google Apps Script (GAS) 後端串接程式碼
 * ========================================================
 * 
 * 【教學步驟】：
 * 1. 打開 Google 雲端硬碟 (Google Drive)，建立一個新的「Google 試算表」，命名為「平板借用登記表」。
 * 2. 點選試算表上方選單的【擴充功能】->【Apps Script】。
 * 3. 清空原本編輯器中的內容，將本檔案的所有程式碼完整複製並貼上。
 * 4. 點選右上角的【部署】->【新增部署作業】。
 * 5. 點選左側齒輪【選取類型】，選擇【網頁應用程式】(Web App)。
 *    - 說明：可填寫「平板借用 API」
 *    - 執行身分：選擇【我 (您的帳號)】
 *    - 誰可以存取：務必選擇【任何人】(Anyone) （這樣網頁才能免登入直接儲存與讀取）
 * 6. 點選【部署】，並授權存取權限。
 * 7. 部署完成後，複製「網頁應用程式網址」(格式如: https://script.google.com/macros/s/.../exec)。
 * 8. 回到借用系統網頁的「⚙️ 系統設定」頁面，貼上此網址並按下「儲存雲端設定」即可完成全校跨裝置同步！
 */

// 當網頁發送 GET 請求時：回傳所有借用清單，以及全校共用的車輛與節次設定
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    var reservations = [];
    
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue; // 空列略過
        
        var item = {
          id: row[0],
          cart: row[1],
          tablets: row[2] ? String(row[2]).split(',') : [],
          isFullCart: row[3] === true || String(row[3]).toLowerCase() === 'true',
          borrowDate: formatDate(row[4]),
          borrowTime: String(row[5] || ''),
          period: String(row[6] || ''),
          returnDate: formatDate(row[7]),
          returnTime: String(row[8] || ''),
          teacherName: String(row[9] || ''),
          className: String(row[10] || ''),
          phone: String(row[11] || ''),
          note: String(row[12] || ''),
          status: String(row[13] || 'borrowed'),
          actualReturnDate: row[14] ? formatDate(row[14]) : '',
          actualReturnTime: String(row[15] || ''),
          createdAt: formatDate(row[16])
        };
        reservations.push(item);
      }
    }
    
    // 讀取全校共用車輛與作息設定
    var config = getConfigFromSheet();
    
    return responseJSON({
      success: true,
      data: reservations,
      config: config
    });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// 當網頁發送 POST 請求時：新增借用、更新狀態、刪除紀錄，或儲存全校系統設定
function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var contents = e.postData ? e.postData.contents : '';
    if (!contents) {
      return responseJSON({ success: false, error: 'No data payload' });
    }
    
    var request = JSON.parse(contents);
    var action = request.action || 'create';
    
    // 1. 儲存全校車輛與作息設定 (全裝置同步)
    if (action === 'saveConfig') {
      saveConfigToSheet(request.config);
      return responseJSON({ success: true, message: '全校設定已成功儲存至 Google 試算表' });
    }
    
    // 2. 新增借用登記
    if (action === 'create') {
      var r = request.data;
      var newRow = [
        r.id || ('TB-' + new Date().getTime()),
        r.cart,
        Array.isArray(r.tablets) ? r.tablets.join(',') : r.tablets,
        r.isFullCart ? 'TRUE' : 'FALSE',
        r.borrowDate,
        r.borrowTime,
        r.period,
        r.returnDate,
        r.returnTime,
        r.teacherName,
        r.className,
        r.phone || '',
        r.note || '',
        r.status || 'borrowed',
        r.actualReturnDate || '',
        r.actualReturnTime || '',
        r.createdAt || new Date().toISOString()
      ];
      sheet.appendRow(newRow);
      return responseJSON({ success: true, id: newRow[0] });
    }
    
    // 3. 歸還註銷 / 更新狀態
    if (action === 'updateStatus') {
      var targetId = request.id;
      var newStatus = request.status;
      var data = sheet.getDataRange().getValues();
      var found = false;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          sheet.getRange(i + 1, 14).setValue(newStatus); // 欄 14 為 status
          if (request.actualReturnDate) sheet.getRange(i + 1, 15).setValue(request.actualReturnDate);
          if (request.actualReturnTime) sheet.getRange(i + 1, 16).setValue(request.actualReturnTime);
          if (request.note) sheet.getRange(i + 1, 13).setValue(request.note);
          found = true;
          break;
        }
      }
      return responseJSON({ success: found, message: found ? '已更新狀態' : '找不到該紀錄' });
    }
    
    // 4. 刪除紀錄
    if (action === 'delete') {
      var targetId = request.id;
      var data = sheet.getDataRange().getValues();
      var found = false;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          sheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      return responseJSON({ success: found, message: found ? '已刪除紀錄' : '找不到該紀錄' });
    }
    
    return responseJSON({ success: false, error: 'Unknown action' });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// 取得或自動建立「借用清單」工作表
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('借用清單');
  if (!sheet) {
    sheet = ss.insertSheet('借用清單');
    var headers = [
      '借用編號', '平板車', '平板編號清單', '是否整車', '借用日期', '借用時間',
      '借用節次', '預計歸還日期', '預計歸還時間', '借用人姓名', '借用班級', '聯絡電話/分機',
      '備註說明', '借用狀態', '實際歸還日期', '實際歸還時間', '登記時間'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#2563EB').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 取得或建立「系統設定」工作表（儲存車輛設定與節次設定）
function getOrCreateConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('系統設定');
  if (!sheet) {
    sheet = ss.insertSheet('系統設定');
    sheet.appendRow(['設定項目', '設定內容 (JSON)']);
    sheet.getRange(1, 1, 1, 2).setBackground('#059669').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 從試算表讀取系統設定 (Carts 與 Periods)
function getConfigFromSheet() {
  try {
    var sheet = getOrCreateConfigSheet();
    var data = sheet.getDataRange().getValues();
    var config = {};
    for (var i = 1; i < data.length; i++) {
      var key = String(data[i][0]).trim();
      var val = data[i][1];
      if (key && val) {
        try {
          config[key] = JSON.parse(val);
        } catch (e) {
          config[key] = val;
        }
      }
    }
    return config;
  } catch (err) {
    return {};
  }
}

// 將系統設定存入試算表
function saveConfigToSheet(configObj) {
  if (!configObj) return;
  var sheet = getOrCreateConfigSheet();
  
  if (configObj.carts) {
    writeSettingRow(sheet, 'carts', JSON.stringify(configObj.carts));
  }
  if (configObj.periods) {
    writeSettingRow(sheet, 'periods', JSON.stringify(configObj.periods));
  }
}

function writeSettingRow(sheet, key, jsonStr) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      return;
    }
  }
  sheet.appendRow([key, jsonStr]);
}

// 輔助函式：日期格式化
function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  return String(d);
}

// 輔助函式：回傳 JSON 回應
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
