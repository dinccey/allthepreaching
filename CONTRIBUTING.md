# Contributing to ALLthePREACHING

Thank you for your interest in contributing to this project!

## Code Style

### JavaScript/TypeScript
- Use ESLint configuration provided
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Meaningful variable names

### React Components
- Functional components with hooks
- TypeScript for type safety
- Props interface definitions
- JSDoc comments for complex functions

### Git Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Keep commits atomic and focused
- Write descriptive commit messages

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes** with tests
4. **Run tests**: `yarn test`
5. **Build to verify**: `yarn build`
6. **Commit changes**: `git commit -m "feat: add my feature"`
7. **Push to your fork**: `git push origin feature/my-feature`
8. **Open a Pull Request** to `develop` branch

### PR Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated (if needed)
- [ ] No console warnings/errors
- [ ] Commits are clean and descriptive

## Development Setup

See README.md for setup instructions.

## Testing

- Write tests for new features
- Maintain or improve code coverage
- Test in multiple browsers (Chrome, Firefox, Safari)
- Test mobile responsiveness

## Code Review

All PRs require:
- Passing CI/CD checks
- Code review approval
- No merge conflicts

## Questions?

Open an issue for discussion before starting major changes.

## License

By contributing, you agree your contributions will be licensed under the project's license.
