var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: 'KTANE Discord bot',
  description: 'The logbot and video announcement bot for the KTANE Discord server.',
  script: 'C:\\Apps\\KTANE Bot\\bot.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();

// // Listen for the "uninstall" event so we know when it's done.
// svc.on('uninstall',function(){
//   console.log('Uninstall complete.');
//   console.log('The service exists: ', svc.exists);
// });
//
// // Uninstall the service.
// svc.uninstall();