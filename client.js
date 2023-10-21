'use strict';

import os from 'os';

const base = process.argv[2];
const hostname = os.hostname().split('.')[0];
const url = new URL(hostname, base);

function
main()
{
	const loadavg = os.loadavg();
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({ loadavg }),
	};
	fetch(url, options)
		.catch(err => console.error(err));

	const now = new Date();
	const second = now.getSeconds();
	const msec = now.getMilliseconds();
	const delay = second * 1000 - msec;
	setTimeout(main, 60000 - delay);
}

main();
