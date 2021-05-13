/* スクリプトプロパティのオブジェクトを取得 */
const prop = PropertiesService.getScriptProperties().getProperties();
/* スプレッドシートを取得 */
const sheet = SpreadsheetApp.openById(prop.SHEETID).getSheetByName(prop.SHEETNAME);
/* 最大選択肢の数 */
const maxOptions = 2;

function doPost(e) {

	/* レスポンスを取得 */
	const responseLine = e.postData.contents;
	/* JSON形式に変換する */
	const responseLineJson = JSON.parse(responseLine).events[0];

// debug
// debugMessage([{'type': 'text', 'text': responseLine}]);

  try {
    /* ステップと回答を特定 */
    var params = (responseLineJson.type != "postback") ? {} : getQueryParams(responseLineJson.postback.data);

    /* 回答終了 */
    if(params['op'] && params['op'] == 'end') {
      var selected = getSelectedHardName(params['answer']);
      reply(responseLineJson, [{
        'type': 'text',
        'text': "回答ありがとう！\nあなたが一番好きなのは " + selected + " なんだね！\nちなみに " + params['num'] + " 回悩んでたよ！"
      }]);
      incrementSelectedHard(params['answer']);
      pushGraph(responseLineJson.source.userId);
      return;
    }

    var template = buildTemplate(params);

// debug
// debugMessage([{'type': 'text', 'text': JSON.stringify(template)}]);

    reply(responseLineJson, [{
      "type": "template",
      "altText": "postback",
      template
    }]);
    
  } catch(ex) {
    console.log("ERROR OCCURED!");
    debugMessage([{'type': 'text', 'text': ex.toString()}]);
  }

  return;
}

function buildTemplate(params) {
  var num = (params['num']) ? Number(params['num']) + 1 : 1;
  var template = {
    "type": "buttons",
    "thumbnailImageUrl": "https://4.bp.blogspot.com/-wnRK7zokKhE/V8VE-yn8OiI/AAAAAAAA9Wo/9I4o2Dx128ESgVVvI9CC9LgPbQTwlTIFACLcB/s800/game_kyoutai_tataku.png",
    "imageAspectRatio": "rectangle",
    "imageSize": "cover",
    "imageBackgroundColor": "#FFFFFF",
    "title": num + " 回目の質問",
    "text": "好きなハードはどっち？",
    "defaultAction": {
      "type": "uri",
      "label": "View detail",
      "uri": "https://qiita.com/soso555"
    },
  };

  if( num == 1 || (params['op'] && params['op'] == 'others')) {
    var prev = 0;
    if(num == 1) num++;
    template["actions"] = [];
    for(var i = 0; i < maxOptions; i++) {
      var option = generateRandomOptionNumber(prev);
      var optionHardName = getSelectedHardName(option);
      if(optionHardName.length > 20) optionHardName = optionHardName.substring(0, 20);
      template["actions"].push({
        "type": "postback",
        "label": optionHardName,
        "data": "num=" + num + "&answer=" + option,
        "displayText": optionHardName
      });
      prev = option;
    }
  }
  else {
    var prevHard = getSelectedHardName(params['answer']);
    if((prevHard.length + 4) > 20) prevHard = prevHard.substring(0, 16);
    var nextOption = generateRandomOptionNumber(params['answer']);
    var nextOptionHardName = getSelectedHardName(nextOption);
    if(nextOptionHardName.length > 20) nextOptionHardName = nextOptionHardName.substring(0, 20);
    template["actions"] = [
      {
        "type": "postback",
        "label": prevHard,
        "data": "num=" + num + "&answer=" + params['answer'],
        "displayText": prevHard,
      },
      {
        "type": "postback",
        "label": nextOptionHardName,
        "data": "num=" + num + "&answer=" + nextOption,
        "displayText": nextOptionHardName
      },
      {
        "type": "postback",
        "label": "確定（" + prevHard + "）",
        "data": "num=" + num + "&answer=" + params['answer'] + "&op=end",
        "displayText": "確定！"
      }
    ];
  }

  template["actions"].push({
    "type": "postback",
    "label": "どちらでもない",
    "data": "num=" + num + "&answer=&op=others",
    "displayText": "どちらでもない"
  });

  return template;
}

function reply(responseLineJson, messages) {
  UrlFetchApp.fetch(prop.REPLY_URL, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + prop.TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': responseLineJson.replyToken,
      'messages': messages,
    }),
  });

  return;
}

function pushGraph(to) {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'YYYY-MM-dd_HHmmss');
  var range = sheet.getRange("A1:B31");
  var chart = sheet.newChart()
                .addRange(range)
                .setPosition(1, 3, 0, 0)
                .setChartType(Charts.ChartType.PIE)
                .setOption('title', "人気度")
                .setOption('titleTextStyle' ,{color: '#545454', fontSize: 20})
                .setOption("legend", "labeled")
                .build();
  var graphImg = chart.getBlob().getAs('image/png'); // グラフを画像に変換
  var folder = DriveApp.getFolderById(prop.TEMP_FOLDER_ID);
  var file = folder.createFile(graphImg);
  file.setName(today);
  
  // 公開設定する
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.EDIT);
  pushMessage(to, [
  {
    "type": "image",
    "originalContentUrl": file.getDownloadUrl(),
    "previewImageUrl": file.getDownloadUrl()
  }]);
  
  DriveApp.getFolderById(prop.TEMP_FOLDER_ID).removeFile(file);

  return;
}

function getQueryParams(path) {
    if (!path) return false;

    var tmpParams = path.split('&');
    var keyValue  = [];
    var params    = {};
 
    for (var i = 0, len = tmpParams.length; i < len; i++) {
        keyValue = tmpParams[i].split('=');
        params[keyValue[0]] = keyValue[1];
    }
 
    return params;
};

function generateRandomOptionNumber(prev = 0) {
  var rowNum = prev;
  var lastHardNum = sheet.getRange(1, 1).getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow();
  while(prev == rowNum) { rowNum = Math.floor( Math.random() * lastHardNum ) + 1; }
  return rowNum;
}

function getSelectedHardName(index) {
  return sheet.getRange("A" + index).getValue();
}

function incrementSelectedHard(index){
  var cnt = sheet.getRange("B" + index).getValue();
  cnt++;
  sheet.getRange("B" + index).setValue(cnt);
}

function debugMessage(message) {
  return pushMessage(prop.DEBUGID, message);
}

function pushMessage(userId, message) {
  UrlFetchApp.fetch(prop.PUSH_URL, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + prop.TOKEN,
    },
    'method': 'post',
    "muteHttpExceptions" : true,
    'payload': JSON.stringify({
      'to': userId,
      'messages': message,
    }),
  });

  return;
}
