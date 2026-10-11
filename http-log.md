## Request 1: GET Equipment Item (200 OK)
### Command:
curl -i https://jsonplaceholder.typicode.com/posts/1

HTTP/1.1 200 OK
Date: Sun, 11 Oct 2026 10:35:07 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 292
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: max-age=43200
etag: W/"124-yiKdLzqO5gfBrJFrcdJ8Yq0LGnU"
expires: -1
pragma: no-cache
vary: Origin, Accept-Encoding
x-content-type-options: nosniff
x-powered-by: Express
x-ratelimit-limit: 3600000
x-ratelimit-remaining: 3599999
x-ratelimit-reset: 1790812826
Accept-Ranges: bytes
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
Age: 2360
cf-cache-status: HIT
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=PtjGxWLfsixT6p5WuL2NOB9Paioxk6oTjguKAWtMsbeFTqT%2FGs4dCk4ICLJtX3GITN3U%2FQQ23oR%2BWLYKfqwKipDWg5MQow7%2F4eXN6Db1Rk%2Fr0sLKjLPj%2B%2BDsTCckUCeK2rAGhCEG%2FHFMf0QN5rzrhvIATIp%2FYG9kXWlu"}]}
Server: cloudflare
CF-RAY: a48d375dcac8fde8-SIN
alt-svc: h3=":443"; ma=86400

{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto"
}

## Request 2: GET All Equipment Listings (200 OK)
### Command:
curl.exe -i https://jsonplaceholder.typicode.com/posts

### Response:
HTTP/1.1 200 OK
Date: Sun, 11 Oct 2026 10:40:43 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: max-age=43200
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
etag: W/"6b80-Ybsq/K6GwwqrYkAsFxqDXGC7DoM"
expires: -1
pragma: no-cache
vary: Origin, Accept-Encoding
x-content-type-options: nosniff
x-powered-by: Express
x-ratelimit-limit: 3600000
x-ratelimit-remaining: 3599999
x-ratelimit-reset: 1790812826
Age: 26828
cf-cache-status: HIT
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=zREBWah%2BDoGFzfzoPS5LlYwgnldaEsL7oD7XT1P02AXYR%2FVW%2BV4Lej007JwflytWl%2BAPCEKKKhDiUS%2FT0UEC69cMnMSNP55LlvvpHejKj4EMeG%2FIgekFIyYCq5KhBLAWoynmjFC6ybJp9ly4J587PTrhPHPHmPbZDbu6"}]}
Server: cloudflare
CF-RAY: a48d3f928c80ef69-SIN
alt-svc: h3=":443"; ma=86400

[
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
    "body": "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto"
  },
  {
    "userId": 1,
    "id": 2,
    "title": "qui est esse",
    "body": "est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla"
  },
  {
    "userId": 1,
    "id": 3,
    "title": "ea molestias quasi exercitationem repellat qui ipsa sit aut",
    "body": "et iusto sed quo iure\nvoluptatem occaecati omnis eligendi aut ad\nvoluptatem doloribus vel accusantium quis pariatur\nmolestiae porro eius odio et labore et velit aut"
  },

  .
  .
  .
  // ... (Total 100 items returned by API)
]

## Request 3: GET Filtered Listings by Owner (200 OK)
### Command:
curl.exe -i "https://jsonplaceholder.typicode.com/posts?userId=1"

### Response:
HTTP/1.1 200 OK
Date: Sun, 11 Oct 2026 10:47:14 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: max-age=43200
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
etag: W/"aa6-j2NSH739l9uq40OywFMn7Y0C/iY"
expires: -1
pragma: no-cache
vary: Origin, Accept-Encoding
x-content-type-options: nosniff
x-powered-by: Express
x-ratelimit-limit: 3600000
x-ratelimit-remaining: 3599999
x-ratelimit-reset: 1790812826
Age: 13228
cf-cache-status: HIT
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=iAuHw4sV5%2F8%2FfR7pqTI7yNqLtrKX0%2BhOr9juyws5a0rIJqVisiWL06Wva2q4H8b2yKGY86cWmK8gl9SpCocLzsbzkha9es9OU0pqdnBgZYuaKcI14JM%2Bs0ijOMTlW6toy5mVNWi3lItzX639Ouf5Jmz9DpagdHvAjnef"}]}
Server: cloudflare
CF-RAY: a48d491ae881d18a-SIN
alt-svc: h3=":443"; ma=86400

[
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
    "body": "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto"
  },
  {
    "userId": 1,
    "id": 2,
    "title": "qui est esse",
    "body": "est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla"
  },
  {
    "userId": 1,
    "id": 3,
    "title": "ea molestias quasi exercitationem repellat qui ipsa sit aut",
    "body": "et iusto sed quo iure\nvoluptatem occaecati omnis eligendi aut ad\nvoluptatem doloribus vel accusantium quis pariatur\nmolestiae porro eius odio et labore et velit aut"
  },
  {
    "userId": 1,
    "id": 4,
    "title": "eum et est occaecati",
    "body": "ullam et saepe reiciendis voluptatem adipisci\nsit amet autem assumenda provident rerum culpa\nquis hic commodi nesciunt rem tenetur doloremque ipsam iure\nquis sunt voluptatem rerum illo velit"
  },
  {
    "userId": 1,
    "id": 5,
    "title": "nesciunt quas odio",
    "body": "repudiandae veniam quaerat sunt sed\nalias aut fugiat sit autem sed est\nvoluptatem omnis possimus esse voluptatibus quis\nest aut tenetur dolor neque"
  },
  {
    "userId": 1,
    "id": 6,
    "title": "dolorem eum magni eos aperiam quia",
    "body": "ut aspernatur corporis harum nihil quis provident sequi\nmollitia nobis aliquid molestiae\nperspiciatis et ea nemo ab reprehenderit accusantium quas\nvoluptate dolores velit et doloremque molestiae"
  },
  {
    "userId": 1,
    "id": 7,
    "title": "magnam facilis autem",
    "body": "dolore placeat quibusdam ea quo vitae\nmagni quis enim qui quis quo nemo aut saepe\nquidem repellat excepturi ut quia\nsunt ut sequi eos ea sed quas"
  },
  {
    "userId": 1,
    "id": 8,
    "title": "dolorem dolore est ipsam",
    "body": "dignissimos aperiam dolorem qui eum\nfacilis quibusdam animi sint suscipit qui sint possimus cum\nquaerat magni maiores excepturi\nipsam ut commodi dolor voluptatum modi aut vitae"
  },
  {
    "userId": 1,
    "id": 9,
    "title": "nesciunt iure omnis dolorem tempora et accusantium",
    "body": "consectetur animi nesciunt iure dolore\nenim quia ad\nveniam autem ut quam aut nobis\net est aut quod aut provident voluptas autem voluptas"
  },
  {
    "userId": 1,
    "id": 10,
    "title": "optio molestias id quia eum",
    "body": "quo et expedita modi cum officia vel magni\ndoloribus qui repudiandae\nvero nisi sit\nquos veniam quod sed accusamus veritatis error"
  }
]

## Request 4: GET User Profile (200 OK)
### Command:
curl.exe -i https://jsonplaceholder.typicode.com/users/1

### Response:
HTTP/1.1 200 OK
Date: Sun, 11 Oct 2026 10:49:06 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 509
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: max-age=43200
etag: W/"1fd-+2Y3G3w049iSZtw5t1mzSnunngE"
expires: -1
pragma: no-cache
vary: Origin, Accept-Encoding
x-content-type-options: nosniff
x-powered-by: Express
x-ratelimit-limit: 3600000
x-ratelimit-remaining: 3599998
x-ratelimit-reset: 1790812826
Age: 13537
Accept-Ranges: bytes
cf-cache-status: HIT
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=y%2FeLrYE5am%2B5EgNKDuRUXnSVHKSIkM075IOn2rstClgM6FBaFsbwUXCvv5SEQogUZE8Nu8L2y8DT6ScS2%2BjXcbDjsB2k%2Bm0z2ma%2FN023lV9rqVsv5rA%2FDCid%2B5q0LoQLFz%2BdWD28tssHzfED9usiI1zIXYcj%2FcF1x9ob"}]}
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
Server: cloudflare
CF-RAY: a48d4bda8f14fd69-SIN
alt-svc: h3=":443"; ma=86400

{
  "id": 1,
  "name": "Leanne Graham",
  "username": "Bret",
  "email": "Sincere@april.biz",
  "address": {
    "street": "Kulas Light",
    "suite": "Apt. 556",
    "city": "Gwenborough",
    "zipcode": "92998-3874",
    "geo": {
      "lat": "-37.3159",
      "lng": "81.1496"
    }
  },
  "phone": "1-770-736-8031 x56442",
  "website": "hildegard.org",
  "company": {
    "name": "Romaguera-Crona",
    "catchPhrase": "Multi-layered client-server neural-net",
    "bs": "harness real-time e-markets"
  }
}
## Request 5: Deliberate Non-Existent Booking (404 Not Found)
### Command:
curl.exe -i https://jsonplaceholder.typicode.com/posts/999999

### Response:
HTTP/1.1 404 Not Found
Date: Sun, 11 Oct 2026 10:50:19 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 2
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: max-age=43200
etag: W/"2-vyGp6PvFo4RvsFtPoIWeCReyIC8"
expires: -1
pragma: no-cache
vary: Origin, Accept-Encoding
x-content-type-options: nosniff
x-powered-by: Express
x-ratelimit-limit: 3600000
x-ratelimit-remaining: 3599991
x-ratelimit-reset: 1791706735
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
Age: 10050
cf-cache-status: HIT
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=eDtYVnTTfGJbDhbnnevxEbADz%2B8unnBzoTLf1%2BTjfe9ZvCBgJ6GYc213yckVaDpEXEHSHRaMC8Ff454l7XI08SouMRtvGx4tFS7p58HUyVeJ0vIleLxXObKLMJnoRsoGvafN9GoNAyBqZFK46wVWDi7jzLR%2FH%2Fnt7qKv"}]}
Server: cloudflare
CF-RAY: a48d4d9ed90e0517-SIN
alt-svc: h3=":443"; ma=86400

{}