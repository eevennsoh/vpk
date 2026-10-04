const { launchDevService } = require("./lib/dev-service-launcher");

launchDevService("backend").catch((error) => {
	console.error(error);
	process.exit(1);
});
