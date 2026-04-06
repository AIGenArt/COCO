# AI Integration Test Guide

## ✅ Pre-Test Checklist

- [x] OpenRouter API key added to `.env.local`
- [x] Model names configured: `deepseek/deepseek-chat` and `deepseek/deepseek-v3`
- [x] Dev server running
- [x] No server errors
- [x] No browser errors

---

## 🧪 Test Suite

### Test 1: Simple Hero Section

**Prompt:**
```
create a hero section
```

**Expected Result:**
- ✅ Plan appears within 1-2 seconds
- ✅ Summary describes creating Hero component
- ✅ Shows 2 actions:
  - Create `components/Hero.tsx`
  - Update `app/page.tsx`
- ✅ "Build This" button is enabled

**Click "Build This":**
- ✅ Mode switches to "Build"
- ✅ Editor locks (overlay appears)
- ✅ Terminal shows: "Build started..."
- ✅ Terminal shows: "Updated file: ..."
- ✅ Terminal shows: "✓ Build completed"
- ✅ Files appear in file tree
- ✅ Editor unlocks

---

### Test 2: Button Component

**Prompt:**
```
add a button component
```

**Expected Result:**
- ✅ Plan shows creating `components/CustomButton.tsx`
- ✅ Code includes TypeScript interface
- ✅ Code includes Tailwind styling
- ✅ Build creates the file successfully

---

### Test 3: Complex Request

**Prompt:**
```
create a pricing section with 3 tiers
```

**Expected Result:**
- ✅ DeepSeek understands the request
- ✅ Plan includes pricing component
- ✅ Code includes 3 pricing tiers
- ✅ Uses proper React/TypeScript patterns

---

### Test 4: Error Handling

**Prompt:**
```
asdfghjkl random nonsense
```

**Expected Result:**
- ✅ Either: AI tries to interpret it
- ✅ Or: Falls back to pattern matching
- ✅ Or: Shows error message
- ✅ App doesn't crash

---

## 🔍 What to Watch For

### ✅ Good Signs

1. **Fast Response** (1-3 seconds for plan)
2. **Structured JSON** from DeepSeek
3. **Complete Code** in actions
4. **Proper File Paths** (components/, app/, etc.)
5. **TypeScript + React** best practices
6. **Tailwind CSS** styling
7. **Files Actually Created** in workspace

### ⚠️ Warning Signs

1. **Slow Response** (>5 seconds)
2. **Generic Plans** ("Plan to: {your prompt}")
3. **Incomplete Code** (missing imports, etc.)
4. **Wrong File Paths** (outside components/app)
5. **JavaScript Instead of TypeScript**
6. **Inline Styles Instead of Tailwind**
7. **Files Not Created** (only plan shown)

### 🔴 Red Flags

1. **API Key Error** ("OpenRouter API key not configured")
2. **Model Not Found** ("Model deepseek/... not found")
3. **JSON Parse Error** (AI returned non-JSON)
4. **Network Error** (OpenRouter unreachable)
5. **Rate Limit** (too many requests)
6. **Editor Stays Locked** (build never completes)
7. **Files Created But Empty** (content not written)

---

## 🐛 Common Issues & Fixes

### Issue: "AI planning error"

**Possible Causes:**
- Invalid API key
- Wrong model name
- OpenRouter down
- Network issue

**Fix:**
1. Check API key in `.env.local`
2. Verify model name: `deepseek/deepseek-chat`
3. Check OpenRouter status
4. Check network connection

---

### Issue: Plan shows but files not created

**Possible Causes:**
- Execute route failing
- Action executor bug
- Workspace store issue

**Fix:**
1. Check browser console for errors
2. Check server logs
3. Verify `actionExecutor.executeBatch()` is called

---

### Issue: Generic plan ("Plan to: ...")

**Possible Causes:**
- AI call failed
- Fell back to pattern matching
- JSON parsing failed

**Fix:**
1. Check if OpenRouter is being called
2. Check response format from DeepSeek
3. Add logging to `openrouter-client.ts`

---

### Issue: Editor stays locked

**Possible Causes:**
- Build never completes
- Error in action executor
- State not updated

**Fix:**
1. Check terminal for errors
2. Manually call `completeBuild()`
3. Refresh page

---

## 📊 Success Criteria

### Minimum Viable (MVP)

- [ ] Plan generates from prompt
- [ ] Plan shows file paths
- [ ] Build creates files
- [ ] Terminal shows progress
- [ ] Editor locks/unlocks correctly

### Production Ready

- [ ] AI understands complex prompts
- [ ] Code quality is high
- [ ] No crashes or errors
- [ ] Fast response times (<3s)
- [ ] Consistent behavior (5/5 tests pass)

---

## 🎯 Next Steps After Testing

### If Tests Pass ✅

1. **Document any quirks** you noticed
2. **Test 5-10 more prompts** to ensure stability
3. **Move to Supabase integration**
4. **Add auth + persistence**

### If Tests Fail ❌

1. **Note which test failed**
2. **Copy error messages**
3. **Check browser + server logs**
4. **Debug the specific issue**
5. **Retest after fix**

---

## 💡 Pro Tips

1. **Start Simple** - Test "create a hero section" first
2. **Check Logs** - Browser console + server logs are your friends
3. **One Thing at a Time** - Don't test multiple features at once
4. **Document Issues** - Write down what you see
5. **Be Patient** - First AI call might be slow (cold start)

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Test 1 (Hero Section): ✅ / ❌
Notes: ___________

Test 2 (Button Component): ✅ / ❌
Notes: ___________

Test 3 (Pricing Section): ✅ / ❌
Notes: ___________

Test 4 (Error Handling): ✅ / ❌
Notes: ___________

Overall: ✅ Ready for Supabase / ❌ Needs fixes

Issues Found:
1. ___________
2. ___________
3. ___________
```

---

## 🚀 Ready to Test!

1. Go to `/workspace`
2. Type: "create a hero section"
3. Wait for plan
4. Click "Build This"
5. Watch the magic happen! ✨

Good luck! 🎉
