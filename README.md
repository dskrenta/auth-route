# auth-route
This repository contains a simple proof of concept performing dynamic routing in a kubernetes cluster based on an `project_id` contained in the subdomain and an JWT token contained in an authorization header. The routing is done through Node.js microservice which validates the JWT, parses the payload, extracts the `project_id` from the subdomain, and proxies the request appropriately to the k8 service associated with the `user_id` and `project_id`.

## Overview

### auth-service
Contains the dockerized Node.js microservice

### k8
- `auth-service.yaml`: Contains k8 configuration for the Node.js auth-service
- `ingress.yaml`: Contains k8 configuration for the nginx ingress controller which routes traffic to auth-service within the cluster
- `project1.yaml`: Contains k8 configuration for an example agent worker, in this case just running a HTML placeholder page with python http server

## Install

1. Have kubectl and a local cluster of choice (developed with minikube)
2. Pull the repo
3. `minikube start` (start your local kubernetes cluster)
3. `kubectl apply -f k8`
4. `kubectl port-forward --namespace ingress-nginx service/ingress-nginx-controller 8080:80`

auth-service should be available locally at [http://localhost:8080](http://localhost:8080)

[auth-service](https://hub.docker.com/repository/docker/dskrenta/auth-service/general) has been pushed publicly to docker hub making startup easier.

## Testing

Generate sample JWT authorization token
```
curl http://localhost:8080/generate-token

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMSIsImlhdCI6MTcyMjk4NTkyMH0.qxpUKTHveDePV6q5HadFnGoXK_mfU8liieJ4X6y6ZPQ
```

Access project1 using a valid JWT authorization token
```
curl -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMSIsImlhdCI6MTcyMjk4NDg4NX0.OUq4kWm4nH2Jm57hw6kBMOMOMuth3NmNECXbeM358g8" http://project1.localhost:8080

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project1</title>
</head>
<body>
    <h1>Welcome to Project1</h1>
    <p>Placeholder page for agent worker</p>
</body>
</html>
```

Attempt to access project1 with no JWT authorization token
```
curl http://project1.localhost:8080

Forbidden
```

Attempt to access project1 using an invalid JWT authorization token
```
curl -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMSIsImlhdCI6MTcyMjk4NDg4NX0.OUq4kWm4nH2Jm57hw6kBMOMOMuth3NmNECXbeM358g8" http://project1.localhost:8080

Forbidden
```

## Considerations
Certain design choices were made to simplify development and time constraints which should be addressed in a production environment.

- The Node.js auth-service uses an in-memory lookup map associating `project_id` to `user_id` and `k8_service`. This should be replaced with an external production ready database server such as postgres. This will enable the application to perform dynamically when this data is modified. For example assigning a new user a worker.
- In order to reduce complexity no custom scripting takes place within the Nginx ingress controller meaning that all requests are proxied through the Node.js service to reach their destination. This has a lot of performance considerations given the Node.js service must be able to stand-up to the full amount of traffic passing through to the workers.
- In a production scenario using a cluster of Node.js instances behind a load balancer makes sense to handle scaling requirements.
- Routing within the ingress controller would undoubtedly be more efficient. The Node.js service could be called externally and return the route to the ingress controller or performing the routing or performing the JWT validation/parsing and route lookup within the ingress controller could be possible through extending Nginx with lua scripting or possibly another open source ingress controller which has greater customization through scripting. Given more time additional ingress controllers could be investigated and tested.
- If the decision to do the full request proxying in the auth-service middleware is made for production it's worth considering other languages for performance reasons like golang for example.

Overall the solution implemented here works as a proof of concept but additional steps should be taken before large scale or production workloads are expected.
