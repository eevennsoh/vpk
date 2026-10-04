const { launchDevService } = require("./lib/dev-service-launcher");

launchDevService("frontend").catch((error) => {
	console.error(error);
	process.exit(1);
});
