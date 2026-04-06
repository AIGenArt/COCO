# COCO Sandbox Documentation

**Version:** 2.0  
**Last Updated:** 2026-03-20  
**Status:** Ready for Implementation

---

## 📚 Documentation Overview

This directory contains the complete documentation for COCO's sandbox architecture. The documentation is split into focused documents for easier navigation.

### Main Documents

#### 1. [COCO Sandbox Master Plan](./coco-sandbox-master-plan.md)
**The complete strategic plan** covering:
- Executive summary and vision
- Critical feedback & improvements (8 key changes)
- MVP specification
- Architecture design
- Security & isolation
- Risk analysis
- Best practices
- AI governance
- Testing strategy
- Monitoring & observability
- Scalability plan

**Read this first** to understand the complete vision and strategy.

#### 2. [COCO Sandbox Implementation Guide](./coco-sandbox-implementation-guide.md)
**File-by-file implementation details** covering:
- Runtime service structure
- Complete code examples
- Next.js app changes
- Implementation phases (A-F)
- First 6 files to implement

**Read this second** when ready to start building.

---

## 🎯 Quick Start

### For Stakeholders
1. Read [Executive Summary](./coco-sandbox-master-plan.md#part-1-executive-summary)
2. Review [Critical Feedback & Improvements](./coco-sandbox-master-plan.md#part-2-critical-feedback--improvements)
3. Understand [MVP Specification](./coco-sandbox-master-plan.md#part-3-mvp-specification)

### For Developers
1. Read [MVP Specification](./coco-sandbox-master-plan.md#part-3-mvp-specification)
2. Study [Architecture Design](./coco-sandbox-master-plan.md#part-4-architecture-design)
3. Follow [Implementation Guide](./coco-sandbox-implementation-guide.md)
4. Start with [First 6 Files](./coco-sandbox-implementation-guide.md#first-6-files-to-implement)

### For Security Team
1. Review [Security & Isolation](./coco-sandbox-master-plan.md#part-6-security--isolation)
2. Study [Risk Analysis](./coco-sandbox-master-plan.md#part-7-risk-analysis)
3. Examine [AI Governance](./coco-sandbox-master-plan.md#part-9-ai-governance)

---

## 🔑 Key Concepts

### Source of Truth
> **Sandbox filesystem is the source of truth.**  
> **Frontend store is only a synchronized cache.**

This is the fundamental principle that guides all implementation decisions.

### Sandbox State Machine
```
creating → starting → running → stopping → stopped → destroying → destroyed
                  ↓
                failed
```

All sandbox operations must respect state transitions.

### Architecture
```
Next.js App (Frontend + Auth)
        ↓
Runtime Service (Sandbox Orchestration)
        ↓
Docker Containers (Isolated Workspaces)
```

Runtime service is **separate** from Next.js app.

### Preview Routing (MVP)
```
/api/preview/:workspaceId/*
```

Path-based proxy, not subdomains (for MVP).

---

## 📋 Implementation Phases

### Phase A: Foundation (Week 1)
- Runtime service skeleton
- Sandbox manager
- State machine
- Docker integration

### Phase B: File Operations (Week 1-2)
- File service
- Read/write/list/delete
- Path validation

### Phase C: Dev Server & Preview (Week 2)
- Dev server manager
- Preview proxy
- Hot reload

### Phase D: Frontend Integration (Week 2-3)
- Runtime client
- Workspace store updates
- Sync service

### Phase E: AI Integration (Week 3)
- Action executor updates
- AI writes to sandbox
- Build session

### Phase F: Polish & Testing (Week 3-4)
- Error handling
- Rate limiting
- Monitoring
- Tests

---

## 🎯 Success Criteria

MVP is complete when:

1. ✅ User creates workspace
2. ✅ Sandbox starts automatically
3. ✅ Dev server runs in sandbox
4. ✅ Preview shows sandbox app
5. ✅ AI creates files in sandbox
6. ✅ Preview updates after changes
7. ✅ Editor syncs with sandbox
8. ✅ Output panel shows logs
9. ✅ Stop/restart works
10. ✅ Files persist across restarts

---

## 🚫 Out of Scope (MVP)

These features are explicitly deferred:

- ❌ GitHub write/commit/PR
- ❌ Subdomain preview URLs
- ❌ Multi-user collaboration
- ❌ Kubernetes
- ❌ Advanced autoscaling
- ❌ Full interactive terminal
- ❌ Enterprise features
- ❌ Billing
- ❌ Team permissions
- ❌ Production deployment
- ❌ Version control UI

---

## 🔒 Security Principles

### Container Isolation
- Read-only root filesystem
- Writable `/workspace` only
- Resource limits (CPU, memory, disk)
- No container-to-container communication

### Command Allowlist
```typescript
const ALLOWED_COMMANDS = [
  'npm install',
  'npm run dev',
  'npm run build',
  'npm run lint',
  'npm run typecheck',
];
```

### Terminal Security
- No free shell in MVP
- Command execution API only
- Output streaming
- Session binding

### Rate Limiting
- Max 5 workspaces per user
- Max 100 API calls/minute
- Max 60 commands/minute
- Max 100 file writes/minute

---

## 📊 Key Metrics

### Performance Targets
- Container creation: < 5s
- File operations: < 100ms
- Preview updates: < 2s
- Terminal latency: < 100ms

### Reliability Targets
- Uptime: 99.9%
- Sync success rate: > 99%
- Zero data loss

### Scale Targets (Post-MVP)
- Support 1000+ concurrent workspaces
- Cost: < $0.10 per workspace hour
- User satisfaction: 95%+

---

## 🛠️ Technology Stack

### Runtime Service
- Node.js/TypeScript
- Express/Fastify
- Docker SDK (dockerode)
- Redis (rate limiting)

### Next.js App
- Next.js 14
- React 18
- Zustand (state)
- Monaco Editor

### Infrastructure
- Docker containers
- Persistent volumes
- Nginx/Traefik (proxy)
- Supabase (metadata)

---

## 📖 Related Documentation

### Existing Docs
- [Sandbox Architecture](./sandbox-architecture.md) - Original architecture notes
- [AI Governance](./ai-governance.md) - AI safety rules
- [Database Schema](./database-schema.md) - Supabase tables
- [API Routes Spec](./api-routes-spec.md) - API documentation

### External Resources
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🤝 Contributing

### Before Starting Implementation

1. Read both main documents completely
2. Understand the 8 critical improvements
3. Review security requirements
4. Familiarize with state machine
5. Set up development environment

### Development Workflow

1. Start with Phase A (Foundation)
2. Implement the first 6 files
3. Test each phase thoroughly
4. Document any deviations
5. Update this documentation

### Code Review Checklist

- [ ] Follows source of truth principle
- [ ] Respects state machine transitions
- [ ] Implements security constraints
- [ ] Includes error handling
- [ ] Has appropriate logging
- [ ] Passes all tests
- [ ] Updates documentation

---

## 📞 Support

### Questions?

- **Architecture:** Review [Master Plan](./coco-sandbox-master-plan.md)
- **Implementation:** Check [Implementation Guide](./coco-sandbox-implementation-guide.md)
- **Security:** See [Security & Isolation](./coco-sandbox-master-plan.md#part-6-security--isolation)

### Issues?

1. Check state machine transitions
2. Verify source of truth principle
3. Review error logs
4. Consult risk analysis section

---

## 🎉 Summary

**You now have:**
- ✅ Complete strategic plan
- ✅ Detailed implementation guide
- ✅ Security framework
- ✅ Risk mitigation strategies
- ✅ Clear success criteria
- ✅ Phase-by-phase roadmap

**Ready to build COCO's sandbox architecture the right way!** 🚀

---

**Last Updated:** 2026-03-20  
**Version:** 2.0  
**Status:** Ready for Implementation
