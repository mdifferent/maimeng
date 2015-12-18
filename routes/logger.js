var log4js = require('log4js');

log4js.configure({
  appenders: [
    { type: 'console' }, //控制台输出
    {
      type: 'file', //文件输出
      filename: 'logs/access.log',
      maxLogSize: 1024,
      backups: 3,
      category: 'normal'
    }
  ],
  replaceConsole: true
});

module.exports = {
  db : log4js.getLogger('db'),
  access: log4js.getLogger('access'),
  system: log4js.getLogger('system'),
  error: log4js.getLogger('error'),
  express: log4js.connectLogger(log4js.getLogger('access'), { level: log4js.levels.INFO })
};
