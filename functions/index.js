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

exports.moveTask = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    console.log(request);
    let taskId = request.body.taskId;
    let preStatus  = request.body.preStatus;
    let nextStatus = request.body.nextStatus;
    let nowplay = request.body.nowplay;
    console.log('move request ', taskId, preStatus, nextStatus);

    admin.database().ref("/task/" + preStatus + "/" + taskId).once('value')
    .then(result => {
      let title = result.val().title;
      let point = result.val().point;
      let limit = result.val().limit;
      let date = result.val().date;
      let comment = result.val().comment;
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
