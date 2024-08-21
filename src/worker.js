import HTML from "./index.html";

//密码
let SECRET_PASSWORD = 'auto';
//订阅转换地址
let SUB_URL = 'url.v1.mk';
//订阅转换的配置文件
let SUB_CONFIG = 'https://raw.githubusercontent.com/bestruirui/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini';
//订阅转换的参数
let BASE_CONFIG = 'filename=BESTRUI&emoji=true&list=false&xudp=true&udp=true&tfo=false&expand=true&scv=false&fdn=false&new_name=true';
//自己的worker地址
let WORKER_URL = 'your.worker.dev'

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		return await handleRequest(request, env, url);
	}
}

async function handleRequest(request, env, url) {
	const path = url.pathname;
	const authHeader = request.headers.get('Authorization');

	if (authHeader !== SECRET_PASSWORD && !['/', '/login', '/' + SECRET_PASSWORD, '/config.ini'].includes(path)) {
		return new Response('Unauthorized', { status: 401 });
	}

	switch (path) {
		case '/':
			if (request.method === 'GET') {
				return new Response(HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
			}
			break;

		case '/login':
			if (request.method === 'POST') {
				const { password } = await request.json();
				return jsonResponse({ success: password === SECRET_PASSWORD });
			}
			break;

		case '/' + SECRET_PASSWORD:
			const results = await getDatabaseResults(env);
			const urls = results.map((item) => `tag:${item.date},${item.url}`).join('|');
			const lastUrl = createSubscriptionUrl(urls);
			const data = await fetchTextData(lastUrl);
			return new Response(data, {
				headers: {
					'Content-Type': 'text/plain;charset=utf-8',
					// 'Content-Disposition': 'attachment; filename="BESTRUI"; filename*=utf-8'
				},
			});

		case '/config.ini':
			const config = await fetchTextData(SUB_CONFIG);
			const configData = await updateConfig(env, config);
			return new Response(configData, { headers: { "Content-Type": "text/plain;charset=UTF-8" } });

		case '/api/get-urls':
			if (request.method === 'POST') {
				const results = await getDatabaseResults(env);
				return jsonResponse(results);
			}
			break;

		case '/api/add-url':
			if (request.method === 'POST') {
				const { url, date } = await request.json();
				await env.MY_D1_DATABASE.prepare("INSERT INTO subs (date, url) VALUES (?, ?)").bind(date, url).run();
				return new Response('URL added', { status: 200 });
			}
			break;

		case '/api/delete-url':
			if (request.method === 'DELETE') {
				const { url } = await request.json();
				await env.MY_D1_DATABASE.prepare("DELETE FROM subs WHERE url = ?").bind(url).run();
				return new Response('URL deleted', { status: 200 });
			}
			break;

		default:
			return new Response('Not Found', { status: 404 });
	}
}

function jsonResponse(data) {
	return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json' },
	});
}

async function getDatabaseResults(env) {
	return (await env.MY_D1_DATABASE.prepare("SELECT * FROM subs").all()).results;
}

function createSubscriptionUrl(urls) {
	const encodeUrl = encodeURIComponent(urls);
	const encodeSubConfigUrl = encodeURIComponent('https://' + WORKER_URL + '/config.ini');
	// const encodeSubConfigUrl = encodeURIComponent(SUB_CONFIG);
	return `https://${SUB_URL}/sub?target=clash&url=${encodeUrl}&insert=false&config=${encodeSubConfigUrl}&${BASE_CONFIG}`;
}

async function fetchTextData(url) {
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'User-Agent': 'clash-verge/v1.7.3',
		}
	});
	return response.text();
}

async function updateConfig(env, config) {
	const { results } = await env.MY_D1_DATABASE.prepare("SELECT date FROM subs").all();
	results.forEach(result => {
		config += `\ncustom_proxy_group=😵‍💫 ${result.date}\`url-test\`!!GROUP=${result.date}\`http://www.gstatic.com/generate_204\`300,,50`;
	});
	return config;
}
