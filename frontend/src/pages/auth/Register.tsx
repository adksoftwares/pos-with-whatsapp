import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(formData.password)) newErrors.password = 'Password must contain at least one number';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        businessName: formData.businessName,
      });
      
      toast.success('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (error: any) {
      if (error.details && Array.isArray(error.details)) {
        // Handle Zod validation details
        const fieldErrors: Record<string, string> = {};
        error.details.forEach((err: any) => {
          const field = err.path.split('.').pop();
          if (field) fieldErrors[field] = err.message;
        });
        setError(fieldErrors);
      } else {
        toast.error(error.message || 'Failed to register');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear error on type
    if (error[e.target.name]) {
      setError(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center text-white font-black text-xl mx-auto mb-4">
            POS
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
          <p className="text-gray-500 mt-1">Start managing your business today</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                label="Full Name" 
                name="name"
                required 
                value={formData.name}
                onChange={handleChange}
                error={error.name}
              />
              <Input 
                label="Email Address" 
                type="email"
                name="email"
                required 
                value={formData.email}
                onChange={handleChange}
                error={error.email}
              />
              <Input 
                label="Business / Store Name" 
                name="businessName"
                required 
                value={formData.businessName}
                onChange={handleChange}
                error={error.businessName}
                helperText="You can change this later in settings"
              />
              <Input 
                label="Password" 
                type={showPassword ? "text" : "password"}
                name="password"
                required 
                value={formData.password}
                onChange={handleChange}
                error={error.password}
                rightIcon={
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-gray-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <Input 
                label="Confirm Password" 
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                required 
                value={formData.confirmPassword}
                onChange={handleChange}
                error={error.confirmPassword}
                rightIcon={
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-gray-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                Create Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
