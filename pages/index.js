// 📸 【高精度自動辨識與強制綁定】
  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setScanning(true);
    setMsg('🔍 正在強效解析截圖中的數值...');

    try {
      const ocrImage = await prepareImageForOCR(selectedFile);

      if (window.Tesseract) {
        const result = await window.Tesseract.recognize(ocrImage, 'eng');
        const fullText = result.data.text;
        
        // 🐞 偵測除錯：直接在瀏覽器 F12 主控台印出 OCR 讀到的原始文字
        console.log('--- OCR 原始辨識文字開始 ---');
        console.log(fullText);
        console.log('--- OCR 原始辨識文字結束 ---');

        const allNums = fullText.replace(/[,.]/g, ' ').match(/\b\d+\b/g) || [];
        console.log('抓到的所有數字陣列：', allNums);
        
        let foundLv = '';
        let foundExp = '';

        // 1. 等級篩選：鎖定 100~200 級
        const validLvs = allNums.map(Number).filter(n => n >= 100 && n <= 200);
        if (validLvs.length > 0) {
          foundLv = String(validLvs[0]);
          setLevel(foundLv); // 強制設定 State
        }

        // 2. 經驗值篩選：鎖定 8 到 11 位數的長數字
        const expCandidates = allNums.filter(numStr => numStr.length >= 8 && numStr.length <= 11);
        if (expCandidates.length > 0) {
          foundExp = expCandidates[0];
          setExpVal(foundExp); // 強制設定 State
        }

        if (foundLv || foundExp) {
          setMsg(`✨ 自動解析完成！抓到等級：[${foundLv || '未抓到'}], 經驗值：[${foundExp || '未抓到'}]。請核對是否正確。`);
        } else {
          setMsg('💡 未能自動辨識出有效數值（可能圖片字型太模糊），請手動輸入等級與經驗值。');
        }
      }
    } catch (err) {
      console.error('OCR 發生錯誤：', err);
      setMsg('❌ 圖片解析失敗，請手動確認等級與經驗值。');
    } finally {
      setScanning(false);
    }
  }
