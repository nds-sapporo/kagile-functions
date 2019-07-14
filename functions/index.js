const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const cors = require('cors')({origin: true});


// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.putMasterTask= functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    console.log(request);
    if (request.method !== 'PUT') {
      response.status(405).send('Method Not Allowed');
      return;
    }
    console.log(request);
    let taskId = request.body.taskId;
    let title  = request.body.title;
    let cycle = request.body.cycle;
    let limit = request.body.limit;
    let point = request.body.point;
    let comment = request.body.comment;
    admin.database().ref("/mastertask/" + taskId).set({
      title: title,
      cycle: cycle,
      limit: limit,
      point: point,
      comment: comment
    });
    response.send("OK");
  });
});

exports.getTask = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    admin.database().ref("/task/").once('value')
    .then(result => {
      response.send(result);
    })
    .catch(error => {
      response.status(404).send({ message: 'Not Found' })
    });
  });
});

exports.calcSummary = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    let point_h = 0;
    let point_w = 0;
    let point_o = 0;
    let okozukai = 0;
    let weight_h = 0;
    let weight_w = 0;
    let summaryDate = 0;

    moveTasks('status_a');
    moveTasks('status_b');
    moveTasks('status_c');

    admin.database().ref("/master/").once('value')
    .then(result => {
      console.log('result val',result.val().okozukai, result.val().weight.husband, result.val().weight.wife, result.val().date);
      okozukai = result.val().okozukai;
      weight_h = result.val().weight.husband;
      weight_w = result.val().weight.wife;
      summaryDate = result.val().date;

      admin.database().ref("/task/status_d/").once('value')
      .then(result2 => {
        result2.forEach(task => {
          let nowplay = task.val().nowplay;
          let point = task.val().point;
          console.log('task ',nowplay, point);
          if (nowplay == 'wife') {
            point_w = point_w + point;
          } else if (nowplay == 'husband') {
            point_h = point_h + point;
          } else {
            point_o = point_o + point;
          }
        });

        admin.database().ref("/summary/" + summaryDate).set({
          okozukai: okozukai,
          point: {
            husband:point_h,
            wife:point_w,
            other:point_o
          },
          weight:{
            husband:weight_h,
            wife:weight_w
          }
        })
        .catch(error => {
          response.status(404).send({ message: 'Not Found3' })
        });

        admin.database().ref("/task/status_d").set(null)
        .catch(error => {
          response.status(404).send({ message: 'Not Found3' })
        });

        refreshTask();
        response.send("OK");
      })
      .catch(error => {
        response.status(404).send({ message: 'Not Found2' })
      });
    })
    .catch(error => {
      response.status(404).send({ message: 'Not Found1' })
    });

  });
});

var moveTasks = (status) => {
  admin.database().ref("/task/" + status ).once('value')
  .then(result2 => {
    result2.forEach(task => {
      let title = task.val().title;
      let point = task.val().point;
      let limit = task.val().limit;
      let date = task.val().date;
      let comment = task.val().comment;
      admin.database().ref("/task/status_d/"+ result2.key).set({
        title: title,
        point: point,
        nowplay: "other",
        limit: limit,
        date: date,
        comment: comment
      })
      .catch(error => {
        console.log('Error sending message:', error);
      });
      admin.database().ref("/task/"+ status ).set(null);
   });
 });
};

exports.moveTask = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    console.log(request);
    let taskId = request.body.taskId;
    let preStatus  = request.body.preStatus;
    let nextStatus = request.body.nextStatus;
    let nowplay = request.body.nowplay;
    let notifyplayer = request.body.nowplay;
    console.log('move request ', taskId, preStatus, nextStatus);

    admin.database().ref("/task/" + preStatus + "/" + taskId).once('value')
    .then(result => {
      let title = result.val().title;
      let point = result.val().point;
      let limit = result.val().limit;
      let date = result.val().date;
      let comment = result.val().comment;
      if (preStatus == "status_b")
      {
        notifyplayer = result.val().nowplay;
      }
      console.log('move request preStatus', taskId, title, point, nowplay, limit, date, comment);

      admin.database().ref("/task/" + nextStatus + "/" + taskId).set({
        title: title,
        point: point,
        nowplay: nowplay,
        limit: limit,
        date: date,
        comment: comment
      })
      .catch(error => {
        response.status(404).send({ message: 'Not Found2' })
      });

      notify(notifyplayer, nextStatus, title);

      admin.database().ref("/task/" + preStatus + "/" + taskId).set(null)
      .catch(error => {
        response.status(404).send({ message: 'Not Found3' })
      });

      response.send("OK");
    })
    .catch(error => {
      response.status(404).send({ message: 'Not Found' })
    });
  });
});

var notify = (player, nextStatus, title) => {
  let name = null;
  let message = null;
  let topic = null;
  if (player == "wife") {
    name = "花子";
    topic = "husband";
  } else {
    name = "太郎";
    topic = "wife";
  }

  if (nextStatus == "status_a") {
    message = "やってに戻したよ";
  } else if (nextStatus == "status_b") {
    message = "やってるよ";
  } else if (nextStatus == "status_c") {
    message = "やったよ";
  } else {
    return false;
  }

  const payload = {
    notification: {
      title: name + "さんが更新したよ！",
      body: name + "さんが[" + title + "]を" + message
    },
    topic: topic
  };

  admin.messaging().send(payload)
  .then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
};

exports.notification = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    notify("wife", "status_b", "燃えるゴミ出し");
    response.send("OK");
  });
});

function getUniqueStr(myStrong){
 var strong = 1000;
 if (myStrong) strong = myStrong;
 return new Date().getTime().toString(16)  + Math.floor(strong*Math.random()).toString(16)
}

var dateFormat = {
  _fmt : {
    "yyyy": function(date) { return date.getFullYear() + ''; },
    "MM": function(date) { return ('0' + (date.getMonth() + 1)).slice(-2); },
    "dd": function(date) { return ('0' + date.getDate()).slice(-2); },
    "hh": function(date) { return ('0' + date.getHours()).slice(-2); },
    "mm": function(date) { return ('0' + date.getMinutes()).slice(-2); },
    "ss": function(date) { return ('0' + date.getSeconds()).slice(-2); }
  },
  _priority : ["yyyy", "MM", "dd", "hh", "mm", "ss"],
  format: function(date, format){
    return this._priority.reduce((res, fmt) => res.replace(fmt, this._fmt[fmt](date)), format)
  }
};

var createTask = (title, comment, limit, point) => {
  let uuid = getUniqueStr();
  let taskId = uuid;
  let nowplay = "other";
  let date = dateFormat.format(new Date(), 'yyyy/MM/dd/hh:mm');

  admin.database().ref("/task/status_a/" + taskId).set({
    title: title,
    point: point,
    nowplay: nowplay,
    limit: limit,
    date: date,
    comment: comment
  })
  .catch(error => {
    console.log('Error set message:', error);
  });
};

exports.createOnceTask = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    let title = request.body.title;
    let comment = request.body.comment;
    let limit = request.body.limit;
    let point = request.body.point - 0;
    createTask(title, comment, limit, point);
    response.send("OK");
  });
});

var refreshTask = () => {
    admin.database().ref("/mastertask/").once('value')
    .then(result => {
      result.forEach(task => {
        let title = task.val().title;
        let comment = task.val().comment;
        let limit = task.val().limit;
        let point = task.val().point;
        let date_yyyy = dateFormat.format(new Date(), 'yyyy');
        let date_mm = dateFormat.format(new Date(), 'MM');
        let date_dd = dateFormat.format(new Date(), 'dd');

        let rep1 = limit.replace('yyyy', date_yyyy);
        let rep2 = rep1.replace('mm', date_mm);
        let rep3 = rep2.replace('dd', date_dd);

        createTask(title, comment, rep3, point);
      });
    })
    .catch(error => {
      console.log('Error set message:', error);
    });

    console.log("OK");
};
