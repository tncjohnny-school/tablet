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
 * 8. 回到借用系統網頁的「⚙️ 系統設定」頁面，貼上此網址並按下「儲存設定」即可完成雲端串接！
 */

// 當網頁發送 GET 請求時：回傳所有借用清單
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    var reservations = [];
    
    // 若只有標題列或無資料
    if (data.length <= 1) {
      return responseJSON({ success: true, data: [] });
    }
    
    var headers = data[0];
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
        createdAt: formatDate(row[14])
      };
      reservations.push(item);
    }
    
    return responseJSON({ success: true, data: reservations });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// 當網頁發送 POST 請求時：新增借用、更新狀態或刪除紀錄
function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var contents = e.postData ? e.postData.contents : '';
    if (!contents) {
      return responseJSON({ success: false, error: 'No data payload' });
    }
    
    var request = JSON.parse(contents);
    var action = request.action || 'create';
    
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
        r.createdAt || new Date().toISOString()
      ];
      sheet.appendRow(newRow);
      return responseJSON({ success: true, id: newRow[0] });
    }
    
    if (action === 'updateStatus') {
      var targetId = request.id;
      var newStatus = request.status;
      var data = sheet.getDataRange().getValues();
      var found = false;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          sheet.getRange(i + 1, 14).setValue(newStatus); // 欄 14 為 status
          found = true;
          break;
        }
      }
      return responseJSON({ success: found, message: found ? '已更新狀態' : '找不到該紀錄' });
    }
    
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

// 取得或自動建立工作表與標題欄位
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('借用清單');
  if (!sheet) {
    sheet = ss.insertSheet('借用清單');
    var headers = [
      '借用編號', '平板車', '平板編號清單', '是否整車', '借用日期', '借用時間',
      '借用節次', '歸還日期', '歸還時間', '借用人姓名', '借用班級', '聯絡電話/分機',
      '備註說明', '借用狀態', '登記時間'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#2563EB').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
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
