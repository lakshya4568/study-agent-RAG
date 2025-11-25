# 🚀 Quick Deploy Guide

## For First-Time Release

### 1. Test Your Build Locally

```bash
npm run build:release
```

This will be in `out/make/` - test it!

### 2. Push a Version Tag

```bash
# Update version in package.json first!
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

### 3. Watch GitHub Actions

- Go to your repo → Actions tab
- Watch the build (takes ~5-10 minutes)
- Download appears in Releases tab when done

## That's It! 🎉

Your users can now download:

- **DMG file** - Drag to Applications, done!
- **ZIP file** - Extract and run

## For Future Releases

1. Update version in `package.json`
2. Commit changes
3. Create new tag: `git tag v1.0.1`
4. Push: `git push origin v1.0.1`
5. Done! GitHub Actions handles the rest.

---

## Important Notes

✅ **Python is bundled** - Users don't install anything  
✅ **Native modules compiled** - Works on any Mac  
✅ **No signing required** - Users just right-click → Open first time  
✅ **Fully automatic** - GitHub Actions does everything

## Need Help?

See full guide: [DEPLOY.md](./DEPLOY.md)
