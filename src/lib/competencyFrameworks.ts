export interface CompetencySkillRequirement {
  skill: string;
  category: string;
  importance: 'Required' | 'Preferred';
  description: string;
}

export interface CompetencyFramework {
  id: string;
  title: string;
  level: string;
  description: string;
  requiredSkills: CompetencySkillRequirement[];
  preferredSkills: CompetencySkillRequirement[];
}

export const COMPETENCY_FRAMEWORKS: Record<string, CompetencyFramework> = {
  'Software Development Engineer (SDE-1)': {
    id: 'sde_backend',
    title: 'Software Development Engineer (Backend / Systems)',
    level: 'L3 / SDE-1 (0-2 YOE)',
    description: 'Tier-1 Product & Fintech backend engineering standards focusing on high-concurrency APIs, relational and distributed persistence, algorithms, and system resilience.',
    requiredSkills: [
      {
        skill: 'REST/gRPC API Development',
        category: 'Backend Architecture',
        importance: 'Required',
        description: 'Design and implementation of clean, scalable, idempotent HTTP/REST or gRPC endpoints.',
      },
      {
        skill: 'Relational Databases & SQL',
        category: 'Data Storage',
        importance: 'Required',
        description: 'Schema modeling, ACID transactions, complex joins, indexes, and query performance optimization.',
      },
      {
        skill: 'Data Structures & Algorithms',
        category: 'Core Computer Science',
        importance: 'Required',
        description: 'Algorithmic complexity (Big-O), arrays, trees, graphs, sorting, searching, and memory efficiency.',
      },
      {
        skill: 'Distributed Systems & Scalability',
        category: 'Systems Architecture',
        importance: 'Required',
        description: 'Understanding of horizontal scaling, load balancing, consensus, and CAP theorem trade-offs.',
      },
      {
        skill: 'Concurrency & Asynchronous Programming',
        category: 'Core Systems',
        importance: 'Required',
        description: 'Multi-threading, mutexes/locks, event loops, async/await patterns, and race-condition prevention.',
      },
      {
        skill: 'Git & Version Control',
        category: 'Engineering Workflow',
        importance: 'Required',
        description: 'Branching strategies, pull requests, resolving merge conflicts, and code reviews.',
      },
    ],
    preferredSkills: [
      {
        skill: 'In-Memory Caching (Redis/Memcached)',
        category: 'Distributed Systems',
        importance: 'Preferred',
        description: 'Cache-aside, write-through, TTL policies, and preventing cache stampedes.',
      },
      {
        skill: 'Containerization (Docker)',
        category: 'DevOps & Infra',
        importance: 'Preferred',
        description: 'Multi-stage Dockerfiles, container isolation, and local development orchestration.',
      },
      {
        skill: 'Message Brokers (Kafka/RabbitMQ)',
        category: 'Distributed Systems',
        importance: 'Preferred',
        description: 'Asynchronous event decoupling, pub/sub topologies, and delivery guarantees.',
      },
      {
        skill: 'Cloud Services (AWS/GCP/Azure)',
        category: 'Cloud Infrastructure',
        importance: 'Preferred',
        description: 'Basic compute (EC2/GCE), serverless functions, S3 blob storage, and managed databases.',
      },
      {
        skill: 'Automated Testing & CI/CD',
        category: 'Quality Engineering',
        importance: 'Preferred',
        description: 'Unit testing, integration testing mocks, and automated GitHub Actions pipelines.',
      },
    ],
  },
  'Frontend Software Engineer': {
    id: 'sde_frontend',
    title: 'Frontend Software Engineer',
    level: 'L3 / Frontend Engineer (0-2 YOE)',
    description: 'Modern web engineering standards focusing on reactive UI architectures, TypeScript, state management, and performance.',
    requiredSkills: [
      {
        skill: 'TypeScript / JavaScript (ES6+)',
        category: 'Languages',
        importance: 'Required',
        description: 'Strong typing, generics, closures, prototypes, event loops, and asynchronous promises.',
      },
      {
        skill: 'React / Modern Web Framework',
        category: 'Frontend Core',
        importance: 'Required',
        description: 'Component lifecycles, custom hooks, memoization, reconciliation, and virtual DOM.',
      },
      {
        skill: 'HTML5, CSS3 & Responsive Design',
        category: 'User Interface',
        importance: 'Required',
        description: 'Semantic markup, Flexbox, CSS Grid, mobile-first design, and Tailwind CSS utilities.',
      },
      {
        skill: 'State Management',
        category: 'Frontend Architecture',
        importance: 'Required',
        description: 'Global vs local state, Redux/Zustand/Context, immutable updates, and state persistence.',
      },
      {
        skill: 'REST/GraphQL API Integration',
        category: 'Networking',
        importance: 'Required',
        description: 'HTTP methods, error handling, optimistic updates, request debouncing, and pagination.',
      },
      {
        skill: 'Web Performance Optimization',
        category: 'Performance',
        importance: 'Required',
        description: 'Code splitting, lazy loading, Core Web Vitals, asset compression, and render tree optimization.',
      },
    ],
    preferredSkills: [
      {
        skill: 'Next.js / Server-Side Rendering (SSR)',
        category: 'Frameworks',
        importance: 'Preferred',
        description: 'Hydration, static site generation, server components, and routing.',
      },
      {
        skill: 'Testing (Jest/Playwright/Cypress)',
        category: 'Testing',
        importance: 'Preferred',
        description: 'Component unit tests, user interaction simulation, and end-to-end testing.',
      },
      {
        skill: 'Web Accessibility (WCAG/ARIA)',
        category: 'Accessibility',
        importance: 'Preferred',
        description: 'Screen reader compatibility, keyboard navigation, and color contrast compliance.',
      },
      {
        skill: 'Bundlers & Build Tools (Vite/Webpack)',
        category: 'Tooling',
        importance: 'Preferred',
        description: 'Module resolution, asset hashing, tree shaking, and environment configuration.',
      },
    ],
  },
  'Full Stack Software Engineer': {
    id: 'sde_fullstack',
    title: 'Full Stack Software Engineer',
    level: 'L3 / Full Stack Engineer (0-2 YOE)',
    description: 'End-to-end application delivery across web user interfaces, server-side APIs, database modeling, and deployment.',
    requiredSkills: [
      {
        skill: 'TypeScript / Modern JavaScript',
        category: 'Languages',
        importance: 'Required',
        description: 'Isomorphic full-stack TypeScript across client and Node.js environments.',
      },
      {
        skill: 'Backend API Development (Node/Express/Python/Go)',
        category: 'Backend',
        importance: 'Required',
        description: 'Routing, middleware, request validation, authentication tokens, and error handling.',
      },
      {
        skill: 'Frontend UI Development (React)',
        category: 'Frontend',
        importance: 'Required',
        description: 'Building modular interactive UI components, hooks, and responsive layouts.',
      },
      {
        skill: 'Relational Databases & SQL',
        category: 'Databases',
        importance: 'Required',
        description: 'Table schemas, foreign keys, migrations, ORM/query builders, and indexes.',
      },
      {
        skill: 'Data Structures & Problem Solving',
        category: 'Core CS',
        importance: 'Required',
        description: 'Algorithmic efficiency, problem decomposition, and runtime complexity analysis.',
      },
      {
        skill: 'Git & Version Control',
        category: 'Workflow',
        importance: 'Required',
        description: 'Collaboration via Git branches, PRs, code reviews, and semantic versioning.',
      },
    ],
    preferredSkills: [
      {
        skill: 'Docker Containerization',
        category: 'DevOps',
        importance: 'Preferred',
        description: 'Containerizing full-stack microservices with Docker Compose.',
      },
      {
        skill: 'In-Memory Caching (Redis)',
        category: 'Performance',
        importance: 'Preferred',
        description: 'Session storage, rate limiting, and database query caching.',
      },
      {
        skill: 'Security & Authentication (JWT/OAuth)',
        category: 'Security',
        importance: 'Preferred',
        description: 'CORS, CSRF, secure HTTP-only cookies, password hashing, and token lifecycles.',
      },
      {
        skill: 'Cloud Deployment (AWS/GCP/Vercel)',
        category: 'Infrastructure',
        importance: 'Preferred',
        description: 'Deploying web services, configuring reverse proxies, and managing environment variables.',
      },
    ],
  },
  'Cloud & DevOps Engineer': {
    id: 'devops_cloud',
    title: 'Cloud & DevOps Engineer',
    level: 'L3 / DevOps Engineer (0-2 YOE)',
    description: 'Infrastructure automation, Linux internals, cloud platform administration, and deployment pipelines.',
    requiredSkills: [
      {
        skill: 'Linux Administration & Shell Scripting',
        category: 'Operating Systems',
        importance: 'Required',
        description: 'Process management, file systems, permissions, Bash scripting, and troubleshooting.',
      },
      {
        skill: 'Docker & Containerization',
        category: 'Containers',
        importance: 'Required',
        description: 'Container image builds, volume mounts, networking, and layer optimization.',
      },
      {
        skill: 'CI/CD Pipeline Automation',
        category: 'Automation',
        importance: 'Required',
        description: 'Continuous integration and delivery with GitHub Actions, GitLab CI, or Jenkins.',
      },
      {
        skill: 'Cloud Platform Core (AWS/GCP/Azure)',
        category: 'Cloud',
        importance: 'Required',
        description: 'VPC networking, compute instances, object storage, and IAM role configuration.',
      },
      {
        skill: 'Infrastructure as Code (Terraform)',
        category: 'IaC',
        importance: 'Required',
        description: 'Declarative resource provisioning, state management, and reusable modules.',
      },
      {
        skill: 'Networking Fundamentals',
        category: 'Networking',
        importance: 'Required',
        description: 'TCP/IP, HTTP/S, DNS resolution, subnets, NAT gateways, and load balancers.',
      },
    ],
    preferredSkills: [
      {
        skill: 'Kubernetes Cluster Management',
        category: 'Orchestration',
        importance: 'Preferred',
        description: 'Pods, Deployments, Services, Ingress, and ConfigMaps.',
      },
      {
        skill: 'Observability (Prometheus/Grafana)',
        category: 'Monitoring',
        importance: 'Preferred',
        description: 'Metrics collection, alerting rules, log aggregation, and dashboard creation.',
      },
      {
        skill: 'Security & Secret Management',
        category: 'Security',
        importance: 'Preferred',
        description: 'Vault, AWS Secrets Manager, encryption at rest and in transit.',
      },
    ],
  },
  'Data Engineer': {
    id: 'data_engineer',
    title: 'Data & Distributed Pipeline Engineer',
    level: 'L3 / Data Engineer (0-2 YOE)',
    description: 'Large-scale distributed data processing, analytical modeling, data warehousing, and ETL/ELT pipelines.',
    requiredSkills: [
      {
        skill: 'Python or Scala Programming',
        category: 'Languages',
        importance: 'Required',
        description: 'Data manipulation, object-oriented design, pandas, and data processing libraries.',
      },
      {
        skill: 'Advanced SQL & Data Modeling',
        category: 'Databases',
        importance: 'Required',
        description: 'Dimensional modeling (Star/Snowflake), window functions, CTEs, and query tuning.',
      },
      {
        skill: 'Data Warehousing (BigQuery/Snowflake/Redshift)',
        category: 'Storage',
        importance: 'Required',
        description: 'Columnar storage engines, clustering, partitioning, and analytical querying.',
      },
      {
        skill: 'ETL / ELT Pipeline Architecture',
        category: 'Pipelines',
        importance: 'Required',
        description: 'Batch and micro-batch data ingestion, data transformations, and deduplication.',
      },
      {
        skill: 'Distributed Processing (Spark/PySpark)',
        category: 'Big Data',
        importance: 'Required',
        description: 'RDDs, DataFrames, shuffles, partitions, and distributed compute bottlenecks.',
      },
      {
        skill: 'Data Quality & Validation',
        category: 'Governance',
        importance: 'Required',
        description: 'Schema enforcement, anomaly detection, null handling, and data reconciliation.',
      },
    ],
    preferredSkills: [
      {
        skill: 'Apache Kafka / Event Streaming',
        category: 'Streaming',
        importance: 'Preferred',
        description: 'Streaming message consumption, consumer groups, and offset management.',
      },
      {
        skill: 'Workflow Orchestration (Airflow)',
        category: 'Orchestration',
        importance: 'Preferred',
        description: 'DAG definitions, task dependencies, retries, and backfilling.',
      },
      {
        skill: 'Transformation Frameworks (dbt)',
        category: 'Transformations',
        importance: 'Preferred',
        description: 'Modular SQL transformations, testing, and data lineage documentation.',
      },
    ],
  },
};

export function getCompetencyFramework(roleTitle: string): CompetencyFramework {
  const normalizedRole = roleTitle.trim().toLowerCase();
  const aliases: Record<string, keyof typeof COMPETENCY_FRAMEWORKS> = {
    'backend systems engineer': 'Software Development Engineer (SDE-1)',
    'full stack engineer': 'Full Stack Software Engineer',
    'data & analytics engineer': 'Data Engineer',
  };
  const aliasMatch = aliases[normalizedRole];
  if (aliasMatch) return COMPETENCY_FRAMEWORKS[aliasMatch];

  const match = Object.entries(COMPETENCY_FRAMEWORKS).find(
    ([key]) => key.toLowerCase() === normalizedRole || normalizedRole.includes(key.toLowerCase().slice(0, 10))
  );
  if (match) return match[1];
  return COMPETENCY_FRAMEWORKS['Software Development Engineer (SDE-1)'];
}
